"""Five ways to spend money from one account, four of which are correct.

Every function here takes an open connection and does one spend. The rig runs
N of them at once against the same account and then looks at the balance. The
difference between them is not style: it is whether the answer is right when
two of them run at the same moment.
"""

from __future__ import annotations

from dataclasses import dataclass

import psycopg


@dataclass(slots=True)
class Outcome:
    mode: str
    succeeded: bool
    retries: int = 0
    refused_by: str | None = None  # 'constraint', 'insufficient funds', ...
    isolation_seen: str | None = None


# --------------------------------------------------------------------- naive
def naive(conn: psycopg.Connection, account_id: int, amount: int) -> Outcome:
    """Read, decide, write. The bug, written the way everybody writes it first.

    The window is between the SELECT and the UPDATE. Both workers read 10,000,
    both decide 1,000 is affordable, both write 9,000, and the account has
    spent 2,000 while the balance says one spend happened.

    Nothing here is obviously wrong, which is the point. It reads like the
    business rule.
    """
    with conn.cursor() as cur:
        cur.execute("select balance_minor from accounts where id = %s", (account_id,))
        row = cur.fetchone()
        assert row is not None
        balance = int(row["balance_minor"])

        if balance < amount:
            return Outcome("naive", succeeded=False, refused_by="insufficient funds")

        cur.execute(
            "update accounts set balance_minor = %s where id = %s",
            (balance - amount, account_id),
        )
    conn.commit()
    return Outcome("naive", succeeded=True)


# ------------------------------------------------------------------ row lock
def row_lock(conn: psycopg.Connection, account_id: int, amount: int) -> Outcome:
    """Pessimistic: take the row, then decide.

    FOR UPDATE makes every other transaction that wants this row wait until
    this one commits. The window closes because there is no longer a moment
    when two workers hold the same value.

    The cost is that the workers queue, so throughput on one hot account is
    one transaction at a time. For an account balance that is usually the
    correct trade: money is exactly the thing you are willing to serialise.
    """
    with conn.cursor() as cur:
        cur.execute(
            "select balance_minor from accounts where id = %s for update",
            (account_id,),
        )
        row = cur.fetchone()
        assert row is not None
        balance = int(row["balance_minor"])

        if balance < amount:
            conn.rollback()
            return Outcome("row_lock", succeeded=False, refused_by="insufficient funds")

        cur.execute(
            "update accounts set balance_minor = balance_minor - %s where id = %s",
            (amount, account_id),
        )
    conn.commit()
    return Outcome("row_lock", succeeded=True)


# ---------------------------------------------------------------- optimistic
def optimistic(
    conn: psycopg.Connection, account_id: int, amount: int, max_retries: int = 10
) -> Outcome:
    """No lock. Write only if nobody else has, and try again when they have.

    The version column is the whole mechanism: the UPDATE carries the version
    that was read, so a writer who was overtaken updates zero rows and knows
    it. Verified in isolation, which is possible because the mechanism does
    not need concurrency to demonstrate:

        worker A reads version 0
        worker B commits, version becomes 1
        worker A writes ... where version = 0   ->   0 rows updated
        balance 9,000, version 1: one spend, not two

    Right when conflicts are rare. Under heavy contention on one row it
    degrades badly, because every retry is work already thrown away.
    """
    retries = 0
    while True:
        with conn.cursor() as cur:
            cur.execute(
                "select balance_minor, version from accounts where id = %s", (account_id,)
            )
            row = cur.fetchone()
            assert row is not None
            balance, version = int(row["balance_minor"]), int(row["version"])

            if balance < amount:
                conn.rollback()
                return Outcome(
                    "optimistic", succeeded=False, retries=retries,
                    refused_by="insufficient funds",
                )

            cur.execute(
                """
                update accounts
                   set balance_minor = %s, version = version + 1
                 where id = %s and version = %s
                """,
                (balance - amount, account_id, version),
            )
            changed = cur.rowcount
        conn.commit()

        if changed == 1:
            return Outcome("optimistic", succeeded=True, retries=retries)

        retries += 1
        if retries > max_retries:
            return Outcome(
                "optimistic", succeeded=False, retries=retries, refused_by="too many retries"
            )


# -------------------------------------------------------------- serializable
def serializable(
    conn: psycopg.Connection, account_id: int, amount: int, max_retries: int = 10
) -> Outcome:
    """Let the database detect the conflict, and retry when it says so.

    Two things matter more than the isolation level itself.

    The level has to be set on the TRANSACTION, not on the session. A
    transaction-mode pooler hands the next statement to a different backend,
    so a session level SET is silently discarded. Verified against a pooled
    Neon connection:

        set session characteristics as transaction isolation level serializable
        select current_setting('transaction_isolation')   ->  read committed

    Nothing failed and nothing warned. The code believed it was serialisable
    and was not, which is why this function reads the level back from inside
    its own transaction and returns it.

    And the retry must catch SerializationFailure and nothing else. A bare
    `except Exception: retry` will happily retry a constraint violation
    forever.
    """
    retries = 0
    while True:
        try:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("set transaction isolation level serializable")
                    cur.execute("select current_setting('transaction_isolation') as level")
                    row = cur.fetchone()
                    assert row is not None
                    isolation = str(row["level"])

                    cur.execute(
                        "select balance_minor from accounts where id = %s", (account_id,)
                    )
                    row = cur.fetchone()
                    assert row is not None
                    balance = int(row["balance_minor"])

                    if balance < amount:
                        return Outcome(
                            "serializable", succeeded=False, retries=retries,
                            refused_by="insufficient funds", isolation_seen=isolation,
                        )

                    cur.execute(
                        "update accounts set balance_minor = %s where id = %s",
                        (balance - amount, account_id),
                    )
            return Outcome(
                "serializable", succeeded=True, retries=retries, isolation_seen=isolation
            )

        except psycopg.errors.SerializationFailure:
            retries += 1
            if retries > max_retries:
                return Outcome(
                    "serializable", succeeded=False, retries=retries,
                    refused_by="too many retries",
                )


# ---------------------------------------------------------------- constraint
def constrained(conn: psycopg.Connection, account_id: int, amount: int) -> Outcome:
    """The naive code, against a database that refuses to go negative.

    This is not a fix for the lost update: two workers still both believe they
    succeeded, and the balance is still wrong by one spend. What it is, is a
    floor. The account cannot go negative no matter what the application
    believes, because the constraint is checked at write time against the row
    as it actually is.

    Verified:  update ... balance_minor - 99999  ->  refused,
               "violates check constraint l8_balance_never_negative",
               balance unchanged at 9,000.

    Every one of the three real fixes should be paired with this. The fix stops
    the race; the constraint stops the consequence of the race you did not think
    of.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                "update accounts set balance_minor = balance_minor - %s where id = %s",
                (amount, account_id),
            )
        conn.commit()
        return Outcome("constraint", succeeded=True)
    except psycopg.errors.CheckViolation:
        conn.rollback()
        return Outcome("constraint", succeeded=False, refused_by="constraint")


MODES = {
    "naive": naive,
    "row_lock": row_lock,
    "optimistic": optimistic,
    "serializable": serializable,
    "constraint": constrained,
}
