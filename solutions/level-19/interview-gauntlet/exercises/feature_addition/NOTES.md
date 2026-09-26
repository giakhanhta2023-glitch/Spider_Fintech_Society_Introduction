# Submission note: paginated statements

## What I did

Added `statement_page()` beside the existing `statement()` rather than changing
it. Filtering by date range, cursor based paging, and the same `data` and `meta`
envelope and the same `StatementError` the rest of the module uses.

Six tests, one of which exists to justify a design decision rather than to check a
behaviour: `test_a_row_inserted_mid_page_does_not_shift_the_next_page`.

## Where I followed the existing style and would not have chosen it

- **`line.__dict__` for serialisation.** Fragile, and it is what the existing
  endpoint does. Changing it would have changed the response shape of the old
  endpoint too.
- **String comparison for dates.** Works because they are ISO 8601, and a real
  date type would be better. Out of scope for a feature, and a note is the right
  place for it.
- **Errors as exceptions with a code.** I would return a result type, and this
  codebase raises, and consistency beats my preference by a distance.

Matching the conventions is the thing being assessed. A pull request that
reformats a file while adding a feature is a bad signal at every company, because
the reviewer now cannot see the feature.

## Where I deviated, and why

**Cursor paging instead of offset paging.** The existing code has no paging at all,
so there was no convention to follow, and offset paging is what most people write
first. With `?offset=50`, a payment arriving while the merchant reads page two
shifts every later row, so they see one row twice and miss another. On a bank
statement that is a support ticket that says money is missing.

The cursor is the last reference on the page, returned opaque. Clients cannot
construct one, so the format stays changeable.

## What I skipped

- **The database query.** This works on a list, because the exercise handed me a
  list. In the real service it is `where reference > $cursor order by at,
  reference limit $n`, which needs an index on `(merchant_id, at, reference)`, and
  without that index this is a sequential scan per page. Level 6's lesson and the
  first thing I would do next.
- **A total count.** Deliberate: a count needs a second query over the whole range
  and clients rarely use it. `has_more` answers the question a page needs.
- **Rate limiting the endpoint.** A merchant paging 40,000 rows at page size 100
  is 400 requests, and there is nothing here stopping them doing that in a loop.
- **The old endpoint's deprecation.** It still returns 40,000 rows for the one
  merchant who has them. It needs a cap and a deprecation header, which is a
  conversation with whoever owns the clients rather than a change I would slip in.

## What I would do next, in order

1. The index, and an `EXPLAIN` to prove the page does not scan.
2. A cap on the old endpoint, behind a flag, with the clients told first.
3. A test at 40,000 rows, because every number in this exercise came from a
   four row fixture.
