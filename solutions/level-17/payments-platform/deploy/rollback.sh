#!/usr/bin/env bash
# The rollback. One API call, and the reason blue green was chosen at all.
#
# **Not run**, the same as bluegreen.sh. The measured equivalent is in
# deploy/rehearsal.py: 6.8 ms median to the first healthy response while the idle
# side still holds the previous version, and 636.2 ms when it has to be redeployed
# first. Against AWS, add the target group's health check interval, which
# dominates both numbers and is configuration rather than code.
#
#   ./deploy/rollback.sh staging
#   ./deploy/rollback.sh staging --time

set -euo pipefail

ENVIRONMENT="${1:?usage: rollback.sh <environment> [--time]}"
started="$(date +%s.%N)"

load_balancer_dns() {
  aws elbv2 describe-load-balancers --names "payments-${ENVIRONMENT}" \
    --query 'LoadBalancers[0].DNSName' --output text
}

listener_arn() {
  aws elbv2 describe-listeners \
    --load-balancer-arn "$(aws elbv2 describe-load-balancers \
      --names "payments-${ENVIRONMENT}" \
      --query 'LoadBalancers[0].LoadBalancerArn' --output text)" \
    --query 'Listeners[0].ListenerArn' --output text
}

target_group_arn() {
  aws elbv2 describe-target-groups --names "payments-${ENVIRONMENT}-$1" \
    --query 'TargetGroups[0].TargetGroupArn' --output text
}

healthy_count() {
  aws elbv2 describe-target-health --target-group-arn "$1" --output json \
    | python -c 'import json,sys; d=json.load(sys.stdin); print(sum(1 for t in d["TargetHealthDescriptions"] if t["TargetHealth"]["State"] == "healthy"))'
}

LISTENER="$(listener_arn)"
BLUE="$(target_group_arn blue)"
GREEN="$(target_group_arn green)"
ACTIVE="$(aws elbv2 describe-listeners --listener-arns "$LISTENER" \
  --query 'Listeners[0].DefaultActions[0].TargetGroupArn' --output text)"
if [[ "$ACTIVE" == "$BLUE" ]]; then TARGET="$GREEN"; else TARGET="$BLUE"; fi

# Refuse to roll back onto a side with no healthy targets. Without this check, a
# rollback during an incident can point traffic at something worse than what is
# already serving, and that version of the mistake ends up in a postmortem.
if [[ "$(healthy_count "$TARGET")" -lt 1 ]]; then
  echo "::error::${TARGET##*/} has no healthy targets, so switching to it would be"
  echo "an outage with extra steps. Redeploy the last known good image first:"
  echo "  ./deploy/bluegreen.sh ${ENVIRONMENT} <previous digest>"
  exit 1
fi

aws elbv2 modify-listener --listener-arn "$LISTENER" \
  --default-actions "Type=forward,TargetGroupArn=${TARGET}" >/dev/null

# The clock stops on the first healthy response through the load balancer, not on
# the API call returning. What a customer experiences is the first request that
# works, and that is the number a runbook is allowed to quote.
until curl -fsS --max-time 2 "https://$(load_balancer_dns)/readyz" >/dev/null; do
  sleep 0.2
done

if [[ "${2:-}" == "--time" ]]; then
  python -c "import sys; print(f'rolled back in {float(sys.argv[2]) - float(sys.argv[1]):.2f} s, decision to first healthy response')" "$started" "$(date +%s.%N)"
else
  echo "rolled back to ${TARGET##*/}"
fi
