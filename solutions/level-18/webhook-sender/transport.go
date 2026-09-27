package sender

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// FakeReceiver is a webhook endpoint that can be told to misbehave, and that
// records what it actually received. The recording is the point: a test that
// asserts the sender retried proves nothing about whether the webhook arrived.
type FakeReceiver struct {
	mu sync.Mutex

	// FailTimes maps an event id to how many attempts should fail before it works.
	FailTimes map[string]int
	// HardFail ids fail permanently, as a 400 would.
	HardFail map[string]bool
	// Latency delays every attempt, so a timeout can be provoked.
	Latency time.Duration
	// Hang makes every attempt wait for its context to expire, which is what an
	// endpoint that accepts the connection and never answers looks like.
	Hang bool

	received  map[string]int
	attempts  int
	maxActive int
	active    int
}

func NewFakeReceiver() *FakeReceiver {
	return &FakeReceiver{
		FailTimes: map[string]int{},
		HardFail:  map[string]bool{},
		received:  map[string]int{},
	}
}

func (f *FakeReceiver) Send(ctx context.Context, endpoint string, payload []byte) error {
	id := string(payload)

	f.mu.Lock()
	f.attempts++
	f.active++
	if f.active > f.maxActive {
		f.maxActive = f.active
	}
	hang := f.Hang
	latency := f.Latency
	hard := f.HardFail[id]
	remaining := f.FailTimes[id]
	if remaining > 0 {
		f.FailTimes[id] = remaining - 1
	}
	f.mu.Unlock()

	defer func() {
		f.mu.Lock()
		f.active--
		f.mu.Unlock()
	}()

	if hang {
		<-ctx.Done()
		return Retryable{Err: fmt.Errorf("no answer: %w", ctx.Err())}
	}
	if latency > 0 {
		select {
		case <-time.After(latency):
		case <-ctx.Done():
			return Retryable{Err: fmt.Errorf("timed out after %s: %w", latency, ctx.Err())}
		}
	}
	if hard {
		return errors.New("400 bad request: the receiver will never accept this")
	}
	if remaining > 0 {
		return Retryable{Err: errors.New("503 service unavailable")}
	}

	f.mu.Lock()
	f.received[id]++
	f.mu.Unlock()
	return nil
}

func (f *FakeReceiver) Received(id string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.received[id]
}

func (f *FakeReceiver) Attempts() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.attempts
}

// MaxConcurrent is how many deliveries the receiver saw at once, which is the
// assertion that the worker pool is a pool rather than a suggestion.
func (f *FakeReceiver) MaxConcurrent() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.maxActive
}

func (f *FakeReceiver) Total() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	total := 0
	for _, n := range f.received {
		total += n
	}
	return total
}
