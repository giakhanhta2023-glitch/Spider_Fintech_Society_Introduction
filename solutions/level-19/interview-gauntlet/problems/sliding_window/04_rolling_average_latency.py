"""Rolling average latency over a fixed number of requests.

Pattern: sliding window, fixed size
Time:    O(n)
Space:   O(1)
First instinct: sum each window, O(n*k). Keeping a running total and subtracting
  the departing element is the whole trick, and the subtlety is floating point
  drift rather than complexity.
Outcome: solved directly, with a note.

The drift note is the interesting part, and it is level 2 again: repeatedly adding
and subtracting floats accumulates error. This returns the total as an integer sum
of integer milliseconds and divides once, so nothing drifts.
"""


def rolling_average_latency(latencies_ms: list[int], window: int) -> list[float]:
    """One average per complete window. Fewer than `window` samples gives [].

    Returning [] rather than partial windows is a decision: a dashboard that
    shows an average of two requests next to an average of a hundred is
    misleading, and the caller cannot tell which is which.
    """
    if window <= 0 or len(latencies_ms) < window:
        return []

    total = sum(latencies_ms[:window])
    averages = [total / window]
    for i in range(window, len(latencies_ms)):
        # Integer arithmetic throughout, so the running total is exact. A float
        # running total drifts by a few microseconds over a million samples,
        # which is invisible and irreproducible, which is the worst combination.
        total += latencies_ms[i] - latencies_ms[i - window]
        averages.append(total / window)
    return averages


def test_rolls_the_window():
    assert rolling_average_latency([10, 20, 30, 40], 2) == [15.0, 25.0, 35.0]


def test_a_window_larger_than_the_data_gives_nothing():
    assert rolling_average_latency([10], 5) == []


def test_the_running_total_is_exact():
    latencies = [61, 250, 61, 250] * 1000
    averages = rolling_average_latency(latencies, 4)
    assert all(a == 155.5 for a in averages)
