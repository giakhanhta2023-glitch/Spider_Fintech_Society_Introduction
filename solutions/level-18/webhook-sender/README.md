# webhook-sender

The level 18 Go component: a worker pool that delivers webhooks, with a timeout on
every call, retries with backoff and full jitter, and a shutdown that loses nothing.

```bash
go vet ./...
go test ./...                              # 8 tests
go test -bench=. -benchmem -benchtime=2s   # throughput, latency, allocations
go test -run TestMemoryAtConcurrency -v    # heap at 10,000 in flight deliveries
```

Measured with Go 1.27.1 on a 12th Gen Intel i5-12450H:

| Workers | Deliveries/s | ns/op | Allocations |
|---|---|---|---|
| 1 | 5,057 | 197,763 | 5 per delivery, 415 B |
| 8 | 41,302 | 24,212 | 5 |
| 64 | 157,455 | 6,351 | 5 |
| 256 | 222,226 | 4,500 | 5 |

9,707 concurrent deliveries held 15.0 MB of heap, which is 1.6 kB each, with 10,003
goroutines live.

The transport is a null implementation, so those numbers are the sender rather than a
receiver: with real HTTP the bound is the receiver. The race detector is unavailable
here, because `-race` needs cgo and there is no C compiler on this machine.

Two bugs the tests found in this code, both worth more than the benchmarks: a batch of
claimed events was dropped on shutdown, and the claim ticker rather than the work was
setting the throughput. Both are written up in
[../payments-api-java/README.md](../payments-api-java/README.md), section 8.
