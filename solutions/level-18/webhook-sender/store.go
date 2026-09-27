package sender

import (
	"fmt"
	"sync"
)

// MemoryStore is the outbox, in memory, with the properties the real table has:
// an event is claimed by one worker at a time, and only a successful send marks it
// delivered.
//
// In Postgres this is `select ... for update skip locked` for the claim and an
// `update ... set delivered_at = now()` for the mark, which is level 11's outbox
// with a different column name.
type MemoryStore struct {
	mu        sync.Mutex
	events    []*Event
	claimed   map[string]bool
	delivered map[string]bool
	failed    map[string]string
	claims    int

	// A cursor, plus a list of events handed back by Release.
	//
	// Claim used to scan the whole slice every call, so the benchmark's throughput
	// fell as the queue grew and what it measured was this scan rather than the
	// sender: 14,093 deliveries a second with the scan against the numbers in the
	// README without it. A real store does this with an index and
	// `for update skip locked`, and an O(n) claim is the in memory version of a
	// missing index.
	cursor   int
	returned []*Event
}

func NewMemoryStore(events ...*Event) *MemoryStore {
	return &MemoryStore{
		events:    events,
		claimed:   map[string]bool{},
		delivered: map[string]bool{},
		failed:    map[string]string{},
	}
}

// Claim hands out up to n events that nobody else holds.
func (s *MemoryStore) Claim(n int) []*Event {
	s.mu.Lock()
	defer s.mu.Unlock()

	var out []*Event

	// Anything handed back by a shutdown goes out first, because it has been
	// waiting longest.
	for len(s.returned) > 0 && len(out) < n {
		event := s.returned[0]
		s.returned = s.returned[1:]
		if s.delivered[event.ID] || s.claimed[event.ID] {
			continue
		}
		if _, failed := s.failed[event.ID]; failed {
			continue
		}
		s.claimed[event.ID] = true
		s.claims++
		out = append(out, event)
	}

	for s.cursor < len(s.events) && len(out) < n {
		event := s.events[s.cursor]
		s.cursor++
		if s.claimed[event.ID] || s.delivered[event.ID] {
			continue
		}
		if _, failed := s.failed[event.ID]; failed {
			continue
		}
		s.claimed[event.ID] = true
		s.claims++
		out = append(out, event)
	}
	return out
}

func (s *MemoryStore) MarkDelivered(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.delivered[id] {
		return fmt.Errorf("%s was already delivered", id)
	}
	s.delivered[id] = true
	delete(s.claimed, id)
	return nil
}

func (s *MemoryStore) MarkFailed(id string, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failed[id] = reason
	delete(s.claimed, id)
	return nil
}

// Release puts a claimed event back, which is what a shutdown does with work it
// did not finish. The event goes to the front of the queue rather than being
// forgotten, because the cursor has already passed it.
func (s *MemoryStore) Release(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.claimed[id] {
		return nil
	}
	delete(s.claimed, id)
	for _, event := range s.events {
		if event.ID == id {
			s.returned = append(s.returned, event)
			break
		}
	}
	return nil
}

func (s *MemoryStore) Delivered() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.delivered)
}

func (s *MemoryStore) Failed() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.failed)
}

func (s *MemoryStore) Claimed() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.claimed)
}

func (s *MemoryStore) Claims() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.claims
}

// IsDelivered is what the crash test asserts against: no event may be marked
// delivered unless the receiver actually received it.
func (s *MemoryStore) IsDelivered(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.delivered[id]
}
