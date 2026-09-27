// Package sender delivers webhooks: a worker pool, a timeout on every call,
// retries with backoff and jitter, and a shutdown that loses nothing.
//
// This is the level's one Go component, and the reason it is one component rather
// than a second full port is in the README: the claim being supported is that an
// unfamiliar language can be picked up and shipped in, not that Go is faster than
// anything.
//
// Four properties, and each one is a webhook system that somebody has had to fix:
//
//  1. A worker pool with a fixed size. Goroutines are cheap and a webhook receiver
//     is not: ten thousand concurrent deliveries to one endpoint is an attack on a
//     customer. The pool is the politeness.
//  2. A timeout on every call, through a context. A receiver that accepts the
//     connection and never answers holds a worker forever otherwise.
//  3. Retries with exponential backoff and full jitter. Fixed interval retries from
//     many senders synchronise into a wave against a receiver that is already
//     struggling.
//  4. A row is marked delivered only after the send succeeded, and the shutdown
//     finishes what it started. Anything else loses webhooks on a deploy.
package sender

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Defaults read from a receiver's documentation rather than chosen by feel.
const (
	DefaultTimeout     = 5 * time.Second
	DefaultMaxAttempts = 4
	DefaultBaseBackoff = 50 * time.Millisecond
	DefaultMaxBackoff  = 2 * time.Second
)

// Event is one webhook waiting to be delivered.
type Event struct {
	ID        string
	Endpoint  string
	Payload   []byte
	Attempts  int
	Delivered bool
}

// Transport is how an event reaches a receiver. Injected so the tests need no
// network, and so a real implementation can be an http.Client with the same
// context deadline.
type Transport interface {
	Send(ctx context.Context, endpoint string, payload []byte) error
}

// Store is the outbox the events come from. The two methods are deliberately
// separate: Claim hands out work, MarkDelivered is the only thing that says a
// webhook is done, and nothing marks an event before its send returns.
type Store interface {
	Claim(n int) []*Event
	MarkDelivered(id string) error
	MarkFailed(id string, reason string) error
	Release(id string) error
}

// Retryable errors are worth another attempt. Anything else is not: a 400 from a
// receiver will be a 400 again, and retrying it is a slower failure.
type Retryable struct {
	Err error
}

func (r Retryable) Error() string { return r.Err.Error() }
func (r Retryable) Unwrap() error { return r.Err }

// Stats is what the sender reports about itself. Counted with atomics because
// several goroutines write them, and a race in the metrics is still a race.
type Stats struct {
	Delivered atomic.Int64
	Failed    atomic.Int64
	Retried   atomic.Int64
	Abandoned atomic.Int64
}

// Config is the sender's shape.
type Config struct {
	Workers     int
	Timeout     time.Duration
	MaxAttempts int
	BaseBackoff time.Duration
	MaxBackoff  time.Duration
	// Rand is injectable so the jitter can be asserted in a test. Nil means a
	// source seeded per sender, which is what production wants.
	Rand *rand.Rand
}

func (c Config) withDefaults() Config {
	if c.Workers <= 0 {
		c.Workers = 8
	}
	if c.Timeout <= 0 {
		c.Timeout = DefaultTimeout
	}
	if c.MaxAttempts <= 0 {
		c.MaxAttempts = DefaultMaxAttempts
	}
	if c.BaseBackoff <= 0 {
		c.BaseBackoff = DefaultBaseBackoff
	}
	if c.MaxBackoff <= 0 {
		c.MaxBackoff = DefaultMaxBackoff
	}
	return c
}

// Sender is the worker pool.
type Sender struct {
	config    Config
	store     Store
	transport Transport
	Stats     Stats

	work  chan *Event
	wg    sync.WaitGroup
	mu    sync.Mutex
	rng   *rand.Rand
	// Injectable so tests do not wait. Returns false when the context ended first,
	// which is how a shutdown mid backoff is distinguished from a completed wait.
	sleep func(context.Context, time.Duration) bool
}

// New builds a sender. It does not start it.
func New(store Store, transport Transport, config Config) *Sender {
	config = config.withDefaults()
	source := config.Rand
	if source == nil {
		source = rand.New(rand.NewSource(time.Now().UnixNano()))
	}
	return &Sender{
		config:    config,
		store:     store,
		transport: transport,
		work:      make(chan *Event, config.Workers),
		rng:       source,
		sleep:     sleepWithContext,
	}
}

// Run drains the store until the context is cancelled, then finishes what the
// workers are already holding and returns.
//
// The ordering here is the whole of the graceful shutdown: stop claiming new work,
// close the channel, wait for the workers. A sender that returns while a worker is
// mid send is a sender that loses webhooks on every deploy.
func (s *Sender) Run(ctx context.Context) error {
	for i := 0; i < s.config.Workers; i++ {
		s.wg.Add(1)
		go s.worker(ctx)
	}

	// The claim loop waits on the ticker only when there was nothing to claim.
	//
	// The first version waited for every tick, which capped throughput at
	// `Workers / 5 ms` regardless of how fast the sends were: the benchmark
	// measured 200 deliveries a second with one worker and 11,424 with sixty four,
	// and both numbers were the ticker rather than the work. A poll interval is for
	// an empty queue, not for a full one.
	claiming := time.NewTicker(5 * time.Millisecond)
	defer claiming.Stop()

	for {
		select {
		case <-ctx.Done():
			// Stop claiming, let the workers finish, and only then return. The
			// deferred wait is not enough on its own: the channel has to be closed
			// or the workers block on a receive forever.
			close(s.work)
			s.wg.Wait()
			return ctx.Err()
		case <-claiming.C:
			batch := s.store.Claim(s.config.Workers * 4)
			for i, event := range batch {
				select {
				case s.work <- event:
				case <-ctx.Done():
					// Claimed and not handed to a worker. Every event still in the
					// batch goes back, not just this one.
					//
					// The first version released only `event` and dropped the rest of
					// the batch on the floor: claimed, never sent, and invisible,
					// because a claimed row is not a pending row. TestShutdownLosesNothing
					// found six stuck events out of five hundred, which is the whole
					// reason that test asserts on the claim count rather than only on
					// the delivery count.
					for _, unsent := range batch[i:] {
						_ = s.store.Release(unsent.ID)
					}
					close(s.work)
					s.wg.Wait()
					return ctx.Err()
				}
			}

			// A full batch means there is probably more waiting, so go round again
			// without waiting for the next tick. `continue` rather than a nested
			// loop, so the ctx.Done() case above is still checked every pass.
			if len(batch) == s.config.Workers*4 {
				select {
				case <-ctx.Done():
					close(s.work)
					s.wg.Wait()
					return ctx.Err()
				default:
					drainNow(claiming)
				}
			}
		}
	}
}

// drainNow makes the next select find the ticker ready, so a busy queue is drained
// at the speed of the workers rather than at the speed of the poll interval.
func drainNow(ticker *time.Ticker) {
	ticker.Reset(time.Microsecond)
}

func (s *Sender) worker(ctx context.Context) {
	defer s.wg.Done()
	for event := range s.work {
		s.deliver(ctx, event)
	}
}

// deliver sends one event, retrying what is worth retrying.
//
// The context passed in is the shutdown context, and each attempt gets its own
// deadline derived from it: a shutdown cancels the wait between attempts
// immediately, and an in flight attempt still gets its full timeout to finish.
func (s *Sender) deliver(ctx context.Context, event *Event) {
	for attempt := 1; attempt <= s.config.MaxAttempts; attempt++ {
		event.Attempts = attempt

		attemptCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.config.Timeout)
		err := s.transport.Send(attemptCtx, event.Endpoint, event.Payload)
		cancel()

		if err == nil {
			// Marked delivered only now, after the send returned successfully.
			// Marking before the send is how a row says delivered for a webhook
			// that never arrived, and no amount of retrying finds it afterwards.
			if markErr := s.store.MarkDelivered(event.ID); markErr != nil {
				s.Stats.Failed.Add(1)
				return
			}
			s.Stats.Delivered.Add(1)
			return
		}

		var retryable Retryable
		if !errors.As(err, &retryable) {
			_ = s.store.MarkFailed(event.ID, err.Error())
			s.Stats.Failed.Add(1)
			return
		}

		if attempt == s.config.MaxAttempts {
			// The budget, and the honest state: not delivered, not permanently
			// failed either. Something has to look at these.
			_ = s.store.MarkFailed(event.ID, fmt.Sprintf(
				"%d attempts failed, last was %v", attempt, err))
			s.Stats.Abandoned.Add(1)
			return
		}

		s.Stats.Retried.Add(1)
		if !s.wait(ctx, attempt) {
			// Shutting down mid retry. Release it rather than dropping it.
			_ = s.store.Release(event.ID)
			return
		}
	}
}

// wait backs off with full jitter. Returns false if the context ended first.
func (s *Sender) wait(ctx context.Context, attempt int) bool {
	ceiling := s.config.BaseBackoff << (attempt - 1)
	if ceiling > s.config.MaxBackoff {
		ceiling = s.config.MaxBackoff
	}

	// Full jitter: a uniform draw from zero to the ceiling, rather than the ceiling
	// plus a little noise. With a thousand senders retrying at once, equal jitter
	// arrives in a narrow band and full jitter spreads across the whole window.
	s.mu.Lock()
	delay := time.Duration(s.rng.Int63n(int64(ceiling) + 1))
	s.mu.Unlock()

	return s.sleep(ctx, delay)
}

func sleepWithContext(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
