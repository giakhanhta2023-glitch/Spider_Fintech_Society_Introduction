package sender

import (
	"context"
	"fmt"
	"runtime"
	"sync/atomic"
	"testing"
	"time"
)

// nullTransport does nothing, so the benchmark measures the sender rather than a
// receiver. A benchmark that includes a fake receiver's sleep is a benchmark of the
// sleep.
type nullTransport struct{ calls atomic.Int64 }

func (n *nullTransport) Send(ctx context.Context, endpoint string, payload []byte) error {
	n.calls.Add(1)
	return nil
}

// BenchmarkThroughput measures deliveries a second at a stated worker count.
//
//	go test -bench=Throughput -benchmem -benchtime=3s
func BenchmarkThroughput(b *testing.B) {
	for _, workers := range []int{1, 8, 64, 256} {
		b.Run(fmt.Sprintf("workers=%d", workers), func(b *testing.B) {
			store := NewMemoryStore(events(b.N)...)
			transport := &nullTransport{}
			s := New(store, transport, Config{Workers: workers})

			ctx, cancel := context.WithCancel(context.Background())
			done := make(chan struct{})
			b.ResetTimer()
			go func() {
				_ = s.Run(ctx)
				close(done)
			}()

			for store.Delivered() < b.N {
				time.Sleep(50 * time.Microsecond)
			}
			b.StopTimer()
			cancel()
			<-done

			b.ReportMetric(float64(b.N)/b.Elapsed().Seconds(), "deliveries/s")
		})
	}
}

// BenchmarkLatency measures the per delivery cost end to end, one at a time, which
// is the number a p99 is built from.
func BenchmarkLatency(b *testing.B) {
	store := NewMemoryStore(events(b.N)...)
	transport := &nullTransport{}
	s := New(store, transport, Config{Workers: 1})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	b.ResetTimer()
	go func() {
		_ = s.Run(ctx)
		close(done)
	}()
	for store.Delivered() < b.N {
		time.Sleep(50 * time.Microsecond)
	}
	b.StopTimer()
	cancel()
	<-done
}

// TestMemoryAtConcurrency reports resident heap for a stated number of in flight
// deliveries, which is the claim a CV line is allowed to make about goroutines.
func TestMemoryAtConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("measures memory, needs a quiet machine")
	}

	const inFlight = 10_000
	receiver := NewFakeReceiver()
	receiver.Latency = 200 * time.Millisecond // so all of them are waiting at once

	store := NewMemoryStore(events(inFlight)...)
	s := New(store, receiver, Config{Workers: inFlight})

	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		_ = s.Run(ctx)
		close(done)
	}()

	// Wait until the receiver is holding a large number of concurrent deliveries.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) && receiver.MaxConcurrent() < inFlight/2 {
		time.Sleep(5 * time.Millisecond)
	}
	runtime.ReadMemStats(&after)
	concurrent := receiver.MaxConcurrent()
	goroutines := runtime.NumGoroutine()

	cancel()
	<-done

	heapMB := float64(after.HeapAlloc-before.HeapAlloc) / (1 << 20)
	t.Logf("%d concurrent deliveries, %d goroutines, %.1f MB heap (%.1f kB each)",
		concurrent, goroutines, heapMB, heapMB*1024/float64(max(concurrent, 1)))

	if concurrent < inFlight/2 {
		t.Fatalf("only %d concurrent deliveries: the measurement did not happen",
			concurrent)
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
