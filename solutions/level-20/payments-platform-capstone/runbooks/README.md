# Runbooks

One per alert, and an alert with no runbook does not page. The rule is level 16's
and it holds here: an alert with no runbook is a question mark delivered at three
in the morning.

| Alert | Runbook | Objective |
|---|---|---|
| `PaymentsFailing` | [payments-failing.md](payments-failing.md) | payments availability |
| `EventBacklogGrowing` | [event-backlog.md](event-backlog.md) | payout freshness |
| `PayoutsUnknown` | [payouts-unknown.md](payouts-unknown.md) | payouts correctness, no budget |
| `VaultRefusingCredential` | [vault-credential.md](vault-credential.md) | payments availability |

Each one was written after the chaos scenario that fires it, which is the only
order that produces a runbook worth reading: the detection times and the outputs
quoted in them are from `chaos/report.json` rather than from imagination.
