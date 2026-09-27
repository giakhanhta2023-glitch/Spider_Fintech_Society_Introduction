package sender

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"
)

func events(n int) []*Event {
	out := make([]*Event, n)
	for i := range out {
		id := fmt.Sprintf("evt_%04d", i)
		out[i] = &Event{ID: id, Endpoint: "https://merchant.example/hook",
			Payload: []byte(id)}
	}
	return out
}

// run drains the sender until every event has left the store, or the deadline hits.
func run(t *testing.T, s *Sender, store *MemoryStore, total int, deadline time.Duration) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		_ = s.Run(ctx)
		close(done)
	}()

	until := time.Now().Add(deadline)
	for time.Now().Before(until) {
		if store.Delivered()+store.Failed() >= total {
			break
		}
		time.Sleep(time.Millisecond)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the sender did not shut down within five seconds")
	}
}

func TestEveryEventIsDeliveredExactlyOnce(t *testing.T) {
	store := NewMemoryStore(events(50)...)
	receiver := NewFakeReceiver()
	s := New(store, receiver, Config{Workers: 8})

	run(t, s, store, 50, 5*time.Second)

	if store.Delivered() != 50 {
		t.Fatalf("delivered %d of 50", store.Delivered())
	}
	if receiver.Total() != 50 {
		t.Fatalf("the receiver got %d webhooks for 50 events", receiver.Total())
	}
	for i := 0; i < 50; i++ {
		id := fmt.Sprintf("evt_%04d", i)
		if got := receiver.Received(id); got != 1 {
			t.Fatalf("%s arrived %d times", id, got)
		}
	}
}

func TestRetriesUntilTheReceiverRecovers(t *testing.T) {
	store := NewMemoryStore(events(3)...)
	receiver := NewFakeReceiver()
	receiver.FailTimes["evt_0001"] = 2 // fails twice, then works

	s := New(store, receiver, Config{Workers: 2, BaseBackoff: time.Millisecond})
	run(t, s, store, 3, 5*time.Second)

	if store.Delivered() != 3 {
		t.Fatalf("delivered %d of 3, failed %d", store.Delivered(), store.Failed())
	}
	if got := receiver.Received("evt_0001"); got != 1 {
		t.Fatalf("the retried event arrived %d times, and once is the only right answer", got)
	}
	if s.Stats.Retried.Load() != 2 {
		t.Fatalf("expected 2 retries, got %d", s.Stats.Retried.Load())
	}
}

func TestAPermanentFailureIsNotRetried(t *testing.T) {
	store := NewMemoryStore(events(2)...)
	receiver := NewFakeReceiver()
	receiver.HardFail["evt_0000"] = true

	s := New(store, receiver, Config{Workers: 2, BaseBackoff: time.Millisecond})
	run(t, s, store, 2, 5*time.Second)

	if store.Failed() != 1 || store.Delivered() != 1 {
		t.Fatalf("failed %d, delivered %d", store.Failed(), store.Delivered())
	}
	if receiver.Attempts() != 2 {
		t.Fatalf("a 400 was attempted %d times: retrying it is a slower failure",
			receiver.Attempts())
	}
}

func TestATimeoutIsRetriedAndThenAbandonedWithinTheBudget(t *testing.T) {
	store := NewMemoryStore(events(1)...)
	receiver := NewFakeReceiver()
	receiver.Hang = true // accepts the connection, never answers

	s := New(store, receiver, Config{
		Workers: 1, Timeout: 20 * time.Millisecond,
		MaxAttempts: 3, BaseBackoff: time.Millisecond,
	})
	run(t, s, store, 1, 5*time.Second)

	if receiver.Attempts() != 3 {
		t.Fatalf("attempted %d times against a budget of 3", receiver.Attempts())
	}
	if s.Stats.Abandoned.Load() != 1 {
		t.Fatalf("expected the event to be abandoned, stats: %d", s.Stats.Abandoned.Load())
	}
	if store.IsDelivered("evt_0000") {
		t.Fatal("an event nobody received is marked delivered")
	}
}

func TestTheWorkerPoolIsRespected(t *testing.T) {
	store := NewMemoryStore(events(200)...)
	receiver := NewFakeReceiver()
	receiver.Latency = 5 * time.Millisecond // so deliveries overlap

	s := New(store, receiver, Config{Workers: 4})
	run(t, s, store, 200, 10*time.Second)

	if got := receiver.MaxConcurrent(); got > 4 {
		t.Fatalf("the receiver saw %d concurrent deliveries for a pool of 4", got)
	}
	if store.Delivered() != 200 {
		t.Fatalf("delivered %d of 200", store.Delivered())
	}
}

// TestShutdownLosesNothing is the level's test: killing the worker under load must
// lose no webhook and leave no row marked delivered that was never sent.
func TestShutdownLosesNothing(t *testing.T) {
	store := NewMemoryStore(events(500)...)
	receiver := NewFakeReceiver()
	receiver.Latency = 2 * time.Millisecond

	s := New(store, receiver, Config{Workers: 8})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		_ = s.Run(ctx)
		close(done)
	}()

	// Cancel mid flight, while workers are certainly busy.
	time.Sleep(40 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown did not finish")
	}

	delivered := store.Delivered()
	if delivered == 0 || delivered == 500 {
		t.Skipf("the cancel landed outside the interesting window (%d delivered)", delivered)
	}

	// The two properties that matter, and the second is the one the level names.
	if got := receiver.Total(); got != delivered {
		t.Fatalf("the receiver got %d webhooks and %d are marked delivered", got, delivered)
	}
	for i := 0; i < 500; i++ {
		id := fmt.Sprintf("evt_%04d", i)
		if store.IsDelivered(id) && receiver.Received(id) == 0 {
			t.Fatalf("%s is marked delivered and never arrived", id)
		}
	}
	if store.Claimed() != 0 {
		t.Fatalf("%d events are still claimed after shutdown, so they are stuck",
			store.Claimed())
	}
	t.Logf("cancelled mid flight: %d delivered, %d received, %d still claimable",
		delivered, receiver.Total(), 500-delivered-store.Failed())
}

func TestBackoffIsJitteredAndBounded(t *testing.T) {
	// A fixed source, so the assertion is about the distribution rather than luck.
	s := New(NewMemoryStore(), NewFakeReceiver(), Config{
		BaseBackoff: 100 * time.Millisecond,
		MaxBackoff:  400 * time.Millisecond,
		Rand:        rand.New(rand.NewSource(18)),
	})

	var delays []time.Duration
	s.sleep = func(ctx context.Context, d time.Duration) bool {
		delays = append(delays, d)
		return true
	}

	for attempt := 1; attempt <= 5; attempt++ {
		s.wait(context.Background(), attempt)
	}

	ceilings := []time.Duration{
		100 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond,
		400 * time.Millisecond, 400 * time.Millisecond, // capped
	}
	for i, delay := range delays {
		if delay < 0 || delay > ceilings[i] {
			t.Fatalf("attempt %d waited %s, outside 0..%s", i+1, delay, ceilings[i])
		}
	}
	// Full jitter means the draws differ. Identical delays would mean the jitter is
	// decorative, which is the version that produces a thundering herd.
	if delays[0] == delays[1] && delays[1] == delays[2] {
		t.Fatal("three identical delays: the jitter is not jittering")
	}
}

func TestShutdownDuringABackoffReleasesTheEvent(t *testing.T) {
	store := NewMemoryStore(events(1)...)
	receiver := NewFakeReceiver()
	receiver.FailTimes["evt_0000"] = 5 // always fails within the budget

	s := New(store, receiver, Config{
		Workers: 1, MaxAttempts: 4, BaseBackoff: 200 * time.Millisecond,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
	defer cancel()
	_ = s.Run(ctx)

	if store.Claimed() != 0 {
		t.Fatal("the event is still claimed, so nothing will ever send it")
	}
	if store.IsDelivered("evt_0000") {
		t.Fatal("marked delivered without a successful send")
	}
}
