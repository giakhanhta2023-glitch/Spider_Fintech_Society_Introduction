"""What this architecture costs per payment, from measured volumes.

    python -m ship.cost

Two halves, and only one of them is trustworthy.

**The volumes are measured.** Bytes per log line, lines per request, spans per
request, series per instance and key service calls per batch all come from the
earlier levels, where they were measured rather than assumed. They are listed
with their source below.

**The prices are not.** `prices.yml` is marked `verified: false` throughout,
because this was written on a machine with no cloud account. The model is the
deliverable; the prices are inputs, and the file says exactly which command
replaces them.

That split is worth keeping even when you do have an account, because the two
halves rot at different speeds: prices change quarterly and your volumes change
every release.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml  # type: ignore[import-untyped]  # stubs: pip install types-PyYAML

HERE = Path(__file__).resolve().parent
HOURS_PER_MONTH = 730          # 24 x 365 / 12, which is the number AWS bills on


# ------------------------------------------------------------------ volumes
@dataclass(frozen=True, slots=True)
class Volumes:
    """Everything the model needs about the system, with where each came from."""

    peak_rps: int = 200
    average_rps: int = 50

    # Level 16, measured: the median rendered JSON line, and the lines one
    # payment emits from edge to capture.
    log_bytes_per_line: int = 152
    log_lines_per_request: int = 6
    log_kept_share: float = 0.070            # the sampling policy, measured
    log_retention_days: int = 30

    # Level 16, measured: the declared series ceiling for one instance.
    series_per_instance: int = 151
    instances: int = 6

    # Level 16, measured: spans in one payment trace, api plus vault plus worker.
    spans_per_request: int = 4
    trace_kept_share: float = 0.01           # tail sampling, plus every failure

    # Level 15, measured: one data key per 100 records, and detokenisation is
    # rare because almost nothing holds the scope.
    tokenisations_per_payment: float = 1.0
    records_per_data_key: int = 100
    detokenisations_per_1000_payments: float = 2.0

    # Sizing decisions, which are choices rather than measurements.
    vcpus_per_task: int = 2
    memory_gb_per_task: int = 4
    database_instances: int = 2
    database_storage_gb: int = 500
    cache_nodes: int = 2
    nat_gateways: int = 2
    egress_gb_per_month: int = 2_000
    settlement_gb_stored: int = 400
    kms_keys: int = 2
    secrets: int = 6

    @property
    def payments_per_month(self) -> int:
        return int(self.average_rps * 60 * 60 * 24 * 30.42)

    @property
    def log_gb_ingested_per_month(self) -> float:
        lines = self.average_rps * 86_400 * 30.42 * self.log_lines_per_request
        return lines * self.log_kept_share * self.log_bytes_per_line / 1e9

    @property
    def log_gb_ingested_unsampled(self) -> float:
        lines = self.average_rps * 86_400 * 30.42 * self.log_lines_per_request
        return lines * self.log_bytes_per_line / 1e9

    @property
    def series(self) -> int:
        return self.series_per_instance * self.instances

    @property
    def million_spans_per_month(self) -> float:
        total = self.average_rps * 86_400 * 30.42 * self.spans_per_request
        return total * self.trace_kept_share / 1e6

    @property
    def queue_million_requests(self) -> float:
        # One publish and one receive and one delete per payment, which is how
        # SQS counts and how people underestimate it by three.
        return self.payments_per_month * 3 / 1e6

    @property
    def kms_requests(self) -> int:
        wraps = self.payments_per_month / self.records_per_data_key
        unwraps = self.payments_per_month * self.detokenisations_per_1000_payments / 1000
        return int(wraps + unwraps)


# -------------------------------------------------------------------- model
@dataclass(frozen=True, slots=True)
class Line:
    name: str
    monthly: float
    workings: str
    sensitive: bool = False


@dataclass
class Model:
    prices: dict = field(default_factory=dict)
    volumes: Volumes = field(default_factory=Volumes)

    @classmethod
    def load(cls, path: Path | None = None, volumes: Volumes | None = None) -> Model:
        document = yaml.safe_load((path or HERE / "prices.yml").read_text(encoding="utf-8"))
        return cls(prices=document, volumes=volumes or Volumes())

    def price(self, name: str) -> float:
        return float(self.prices["prices"][name]["value"])

    def sensitive(self, name: str) -> bool:
        return bool(self.prices["prices"][name].get("sensitivity") == "high")

    @property
    def unverified(self) -> list[str]:
        return [
            name for name, body in self.prices["prices"].items()
            if not body.get("verified", False)
        ]

    def lines(self) -> list[Line]:
        v = self.volumes
        out: list[Line] = []

        compute = (
            v.instances * v.vcpus_per_task * self.price("fargate_vcpu_hour")
            + v.instances * v.memory_gb_per_task * self.price("fargate_gb_hour")
        ) * HOURS_PER_MONTH
        out.append(Line(
            "compute", compute,
            f"{v.instances} tasks x ({v.vcpus_per_task} vCPU + "
            f"{v.memory_gb_per_task} GB) x {HOURS_PER_MONTH} h",
            self.sensitive("fargate_vcpu_hour"),
        ))

        database = (
            v.database_instances * self.price("rds_r7g_2xlarge_hour") * HOURS_PER_MONTH
            + v.database_storage_gb * self.price("rds_storage_gb_month")
        )
        out.append(Line(
            "database", database,
            f"{v.database_instances} instances x {HOURS_PER_MONTH} h + "
            f"{v.database_storage_gb} GB",
            self.sensitive("rds_r7g_2xlarge_hour"),
        ))

        cache = v.cache_nodes * self.price("elasticache_t4g_medium_hour") * HOURS_PER_MONTH
        out.append(Line("cache", cache, f"{v.cache_nodes} nodes x {HOURS_PER_MONTH} h"))

        queue = v.queue_million_requests * self.price("sqs_million_requests")
        out.append(Line(
            "queue", queue,
            f"{v.queue_million_requests:,.0f} M requests, 3 per payment",
        ))

        nat = (
            v.nat_gateways * self.price("nat_gateway_hour") * HOURS_PER_MONTH
            + v.egress_gb_per_month * self.price("nat_gateway_gb")
        )
        out.append(Line(
            "nat gateways", nat,
            f"{v.nat_gateways} x {HOURS_PER_MONTH} h + {v.egress_gb_per_month:,} GB processed",
            self.sensitive("nat_gateway_hour"),
        ))

        balancer = (
            self.price("alb_hour") * HOURS_PER_MONTH
            + 25 * self.price("alb_lcu_hour") * HOURS_PER_MONTH
        )
        out.append(Line(
            "load balancer", balancer, f"1 x {HOURS_PER_MONTH} h + 25 capacity units"
        ))

        logs = (
            v.log_gb_ingested_per_month * self.price("logs_gb_ingested")
            + v.log_gb_ingested_per_month * self.price("logs_gb_stored_month")
        )
        out.append(Line(
            "logs", logs,
            f"{v.log_gb_ingested_per_month:,.0f} GB ingested, "
            f"{v.log_kept_share:.0%} of {v.log_gb_ingested_unsampled:,.0f} GB",
            self.sensitive("logs_gb_ingested"),
        ))

        metrics = v.series * self.price("metrics_series_month")
        out.append(Line(
            "metrics", metrics,
            f"{v.series:,} series, {v.series_per_instance} per instance x {v.instances}",
            self.sensitive("metrics_series_month"),
        ))

        traces = v.million_spans_per_month * self.price("traces_million_spans")
        out.append(Line(
            "traces", traces,
            f"{v.million_spans_per_month:,.0f} M spans, {v.trace_kept_share:.0%} tail sampled",
        ))

        keys = (
            v.kms_keys * self.price("kms_key_month")
            + v.kms_requests / 10_000 * self.price("kms_10k_requests")
        )
        out.append(Line(
            "key service", keys,
            f"{v.kms_keys} keys + {v.kms_requests:,} requests, one data key per "
            f"{v.records_per_data_key} records",
        ))

        secrets = v.secrets * self.price("secret_month")
        out.append(Line("secrets", secrets, f"{v.secrets} secrets"))

        storage = v.settlement_gb_stored * self.price("s3_gb_month")
        out.append(Line("settlement files", storage, f"{v.settlement_gb_stored} GB"))

        egress = v.egress_gb_per_month * self.price("egress_gb")
        out.append(Line(
            "egress", egress,
            f"{v.egress_gb_per_month:,} GB out. Ingress is free, which is the trap",
        ))

        return out

    # ------------------------------------------------------------ totals
    def total(self) -> float:
        return sum(line.monthly for line in self.lines())

    def per_payment(self) -> float:
        return self.total() / self.volumes.payments_per_month

    def processing_fee_per_payment(self, average_minor: int = 7790) -> float:
        """The number to compare against, from the level 9 mean capture of $77.90."""
        fee = self.prices["processing_fee"]
        percent = float(fee["percent"])
        fixed = float(fee["fixed_cents"])
        return average_minor / 100 * percent / 100 + fixed / 100

    def idle_share(self) -> float:
        """How much of the compute line exists for a peak that is not happening.

        Sized for 200 payments a second while averaging 50, so three quarters of
        the compute line is insurance. That is the single largest piece of waste
        in nearly every one of these models, and it is a reliability decision
        rather than a mistake.
        """
        return 1 - self.volumes.average_rps / self.volumes.peak_rps


def main() -> None:
    model = Model.load()
    lines = sorted(model.lines(), key=lambda line: -line.monthly)
    total = model.total()

    print(f"monthly cost, {model.volumes.payments_per_month:,} payments "
          f"at {model.volumes.average_rps} a second average, "
          f"{model.volumes.peak_rps} at peak\n")

    width = max(len(line.name) for line in lines)
    for line in lines:
        mark = " *" if line.sensitive else "  "
        print(f"   {line.name:<{width}}{mark} ${line.monthly:9,.0f}  "
              f"{line.monthly / total:5.1%}   {line.workings}")
    print(f"   {'total':<{width}}   ${total:9,.0f}")

    per_payment = model.per_payment()
    fee = model.processing_fee_per_payment()
    print(f"\n   per payment            ${per_payment:.6f}")
    print(f"   processing fee         ${fee:.4f}   (2.9% + 30c on the $77.90 mean "
          f"capture from level 9)")
    print(f"   infrastructure is      {per_payment / fee:.4%} of the fee, "
          f"1 part in {fee / per_payment:,.0f}")
    print(f"\n   idle capacity          {model.idle_share():.0%} of the compute line, "
          f"sized for peak")

    unverified = model.unverified
    if unverified:
        print(f"\n{len(unverified)} of {len(model.prices['prices'])} unit prices are "
              f"marked unverified in prices.yml.")
        print("Lines marked * are the ones whose price moves the total. Replace those "
              "first, with")
        print("your own invoice rather than a list price, before quoting any of this.")


if __name__ == "__main__":
    main()
