"""The deploy rehearsal, run for real, with the numbers the README publishes.

    python -m deploy.rehearsal

Six acts:

1. version 1 serves traffic
2. version 2 deploys to the idle side, becomes ready, takes over
3. a rollback to version 1 by switching, timed from decision to first healthy
   response
4. version 3 is broken. It deploys, never becomes ready, and receives nothing
5. a rollback attempted while the idle side holds that broken version: refused,
   then done by redeploying the last known good version, and timed again
6. the payout kill switch, turned off without a deploy and without a restart

Act 5 exists because writing this file found the hazard. With two sides, a deploy
onto the idle side overwrites whatever was there, so a failed deploy has already
destroyed the rollback target. The fast rollback is a pointer moving; once the
idle side holds a broken version, a rollback is a deploy again. Both numbers are
published, because quoting only the fast one is how a runbook promises four
hundred milliseconds and delivers a readiness gate.

Everything runs on the loopback interface with no container runtime, so the
numbers are for the mechanics rather than for anybody's cloud. A real switch adds
the load balancer's own health check interval, which is the dominant term and is
configuration rather than code: two consecutive successes at a 5 second interval
is 10 seconds before a real target group will route to a new version, whatever
this rehearsal measures.
"""

from __future__ import annotations

import json
import statistics
import tempfile
import time
from pathlib import Path

from app.flags import Flags
from app.service import Version
from deploy.bluegreen import DeployRefused, Router

FLAG_FILE = {
    "flags": {
        "payouts_enabled": {
            "description": "The kill switch on the payout path. Off stops payouts.",
            "rollout": 1.0,
            "expires": "2027-01-31",
            "kill_switch": True,
        },
        "payouts_v2": {
            "description": "The new payout orchestrator from level 12.",
            "rollout": None,
            "expires": "2026-12-01",
            "kill_switch": False,
        },
    }
}


def write_flags(path: Path, payouts_on: bool) -> None:
    body = json.loads(json.dumps(FLAG_FILE))
    body["flags"]["payouts_enabled"]["rollout"] = 1.0 if payouts_on else None
    path.write_text(json.dumps(body, indent=2), encoding="utf-8")


def rehearse(runs: int = 5) -> dict:
    """Run the whole sequence `runs` times and report the median of each timing."""
    from app.service import serve

    ready_times: list[float] = []
    switch_rollbacks: list[float] = []
    redeploy_rollbacks: list[float] = []
    result: dict = {}

    for _ in range(runs):
        with tempfile.TemporaryDirectory() as temporary:
            flag_path = Path(temporary) / "flags.json"
            write_flags(flag_path, payouts_on=True)
            flags = Flags(path=flag_path, cache_seconds=0.0)

            router = Router()
            router.set_side("blue", serve(Version("v1", flags=flags)))
            router.active = "blue"

            try:
                # 1. version 1 is serving
                status, payload = router.payment(1999)
                assert status == 201 and payload["version"] == "v1", (status, payload)

                # 2. a good deploy: onto green, gated, then switched
                good = router.deploy(Version("v2", flags=flags))
                assert good["switched"] is True
                ready_times.append(good["ready_after_seconds"])
                status, payload = router.payment(2999)
                assert payload["version"] == "v2", payload

                # 3. the fast rollback: blue still holds v1
                fast = router.rollback()
                assert fast["serving_version"] == "v1", fast
                switch_rollbacks.append(fast["seconds_to_first_healthy_response"])

                # Forward again, so the next state is reached honestly: green
                # holds v2 and is active, blue holds v1.
                router.deploy(Version("v2", flags=flags))

                # 4. a broken deploy onto blue, which overwrites v1
                before = dict(router.served)
                broken = router.deploy(
                    Version("v3-broken", flags=flags, broken=True), timeout=1.0
                )
                assert broken["switched"] is False, broken
                active_after_broken = router.active
                status, payload = router.payment(999)
                broken_side_served = router.served[broken["candidate"]] - before[
                    broken["candidate"]
                ]

                # 5. the rollback that cannot switch, and the one that can
                refused = ""
                try:
                    router.rollback()
                except DeployRefused as exc:
                    refused = str(exc)
                assert refused, "rolling back onto a broken side should be refused"

                slow = router.rollback_by_redeploy(Version("v1", flags=flags))
                assert slow["serving_version"] == "v1", slow
                redeploy_rollbacks.append(slow["seconds_to_first_healthy_response"])

                # 6. the kill switch, with no deploy and no restart
                status_on, _ = router.payment(1999, payout=True)
                write_flags(flag_path, payouts_on=False)
                status_off, body_off = router.payment(1999, payout=True)

                result = {
                    "good_deploy": good,
                    "broken_deploy": broken,
                    "active_after_broken_deploy": active_after_broken,
                    "requests_served_by_broken_side": broken_side_served,
                    "serving_after_broken_deploy": payload.get("version"),
                    "refusal": refused,
                    "fast_rollback": fast,
                    "slow_rollback": slow,
                    "payout_with_switch_on": status_on,
                    "payout_with_switch_off": status_off,
                    "payout_refusal": body_off,
                    "flag_reads": flags.reads,
                    "flag_reloads": flags.reloads,
                }
            finally:
                router.stop()

    result["runs"] = runs
    result["median_ready_after_seconds"] = statistics.median(ready_times)
    result["median_switch_rollback_seconds"] = statistics.median(switch_rollbacks)
    result["median_redeploy_rollback_seconds"] = statistics.median(redeploy_rollbacks)
    result["all_switch_rollbacks"] = sorted(round(r, 4) for r in switch_rollbacks)
    result["all_redeploy_rollbacks"] = sorted(round(r, 4) for r in redeploy_rollbacks)
    return result


def main() -> None:
    started = time.perf_counter()
    r = rehearse()

    print("blue green rehearsal, median of five runs\n")
    print("1. a good deploy became ready in       "
          f"{r['median_ready_after_seconds'] * 1000:8.1f} ms, then took over")
    print("2. rollback by switching               "
          f"{r['median_switch_rollback_seconds'] * 1000:8.1f} ms to the first healthy response")
    print("   every run:                          "
          + ", ".join(f"{x * 1000:.1f}" for x in r["all_switch_rollbacks"]) + " ms")
    print("3. the broken version served           "
          f"{r['requests_served_by_broken_side']:8d} requests")
    print("   traffic stayed on                   "
          f"{r['serving_after_broken_deploy']:>8s}, side {r['active_after_broken_deploy']}")
    print(f"   the deploy refused to switch:       {r['broken_deploy']['reason']}")
    print("4. rollback with the idle side broken:  refused")
    print(f"   rollback by redeploying instead     "
          f"{r['median_redeploy_rollback_seconds'] * 1000:8.1f} ms")
    print("   every run:                          "
          + ", ".join(f"{x * 1000:.1f}" for x in r["all_redeploy_rollbacks"]) + " ms")
    print(f"5. payout with the switch on           {r['payout_with_switch_on']:8d}")
    print(f"   payout with the switch off          {r['payout_with_switch_off']:8d}  "
          f"({r['payout_refusal'].get('error')})")
    print("\nNo restart, no deploy and no process replaced for the switch. "
          f"{r['flag_reads']} flag reads in the last run.")
    print(f"Whole rehearsal, five times over: {time.perf_counter() - started:.1f} s")


if __name__ == "__main__":
    main()
