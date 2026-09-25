#!/usr/bin/env bash
# Blue green against AWS: the same three decisions as deploy/bluegreen.py, with an
# invoice attached.
#
# **Not run.** There is no cloud account behind this solution, and
# infra/NOT_APPLIED.md says so. The logic it implements is the logic that was
# measured: deploy/rehearsal.py runs the identical sequence against two local
# processes, five times, and the README publishes those numbers.
#
#   ./deploy/bluegreen.sh staging ghcr.io/finquest/payments-api@sha256:...
#
# The second argument is a digest, never a tag. A tag can be moved after the tests
# passed, which makes "the image that was tested is the image that deployed" a
# hope rather than a property.

set -euo pipefail

ENVIRONMENT="${1:?usage: bluegreen.sh <environment> <image digest>}"
IMAGE="${2:?usage: bluegreen.sh <environment> <image digest>}"
CLUSTER="payments-${ENVIRONMENT}"

load_balancer_arn() {
  aws elbv2 describe-load-balancers --names "payments-${ENVIRONMENT}" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text
}

listener_arn() {
  aws elbv2 describe-listeners --load-balancer-arn "$(load_balancer_arn)" \
    --query 'Listeners[0].ListenerArn' --output text
}

target_group_arn() {
  aws elbv2 describe-target-groups --names "payments-${ENVIRONMENT}-$1" \
    --query 'TargetGroups[0].TargetGroupArn' --output text
}

healthy_count() {
  aws elbv2 describe-target-health --target-group-arn "$1" \
    --query 'length(TargetHealthDescriptions[?TargetHealth.State==$STATE])' \
    --output text --no-cli-pager 2>/dev/null \
    || aws elbv2 describe-target-health --target-group-arn "$1" \
         --output json | python -c 'import json,sys; d=json.load(sys.stdin); print(sum(1 for t in d["TargetHealthDescriptions"] if t["TargetHealth"]["State"] == "healthy"))'
}

LISTENER="$(listener_arn)"
BLUE="$(target_group_arn blue)"
GREEN="$(target_group_arn green)"
ACTIVE="$(aws elbv2 describe-listeners --listener-arns "$LISTENER" \
  --query 'Listeners[0].DefaultActions[0].TargetGroupArn' --output text)"

if [[ "$ACTIVE" == "$BLUE" ]]; then
  IDLE="$GREEN"; IDLE_NAME=green
else
  IDLE="$BLUE"; IDLE_NAME=blue
fi
echo "active: ${ACTIVE##*/}   deploying to: ${IDLE##*/}"

# 1. Start the new version on the idle side. Nothing routes to it yet.
TASK_DEFINITION="$(
  jq --arg image "$IMAGE" '.containerDefinitions[0].image = $image' deploy/taskdef.json \
    | aws ecs register-task-definition --cli-input-json file:///dev/stdin \
        --query 'taskDefinition.taskDefinitionArn' --output text
)"

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "payments-api-${IDLE_NAME}" \
  --task-definition "$TASK_DEFINITION" \
  --force-new-deployment >/dev/null

# 2. The gate. Wait for the idle target group to report healthy targets, and
#    refuse to switch if it never does. This is the whole safety property: a
#    version whose readiness check fails receives no traffic, ever, because the
#    switch below does not happen.
echo "waiting for ${IDLE_NAME} to become healthy"
deadline=$(( $(date +%s) + 300 ))
until [[ "$(healthy_count "$IDLE")" -ge 2 ]]; do
  if (( $(date +%s) > deadline )); then
    echo "::error::${IDLE_NAME} never became healthy. Traffic was not switched."
    aws logs tail "/ecs/payments-${ENVIRONMENT}" --since 5m --format short | tail -50
    exit 1
  fi
  sleep 5
done

# 3. The switch. One API call, and it is the entire deploy.
aws elbv2 modify-listener --listener-arn "$LISTENER" \
  --default-actions "Type=forward,TargetGroupArn=${IDLE}" >/dev/null

echo "switched to ${IDLE_NAME}. The previous version is still running:"
echo "  ./deploy/rollback.sh ${ENVIRONMENT} --time"

# The old side is left running on purpose. It is the rollback target, and
# stopping it to save a few dollars is how a rollback becomes a deploy. The
# hazard is documented in deploy/bluegreen.py: once the idle side no longer holds
# a known good version, the fast rollback is gone and the slow one is 90 times
# slower in the measured rehearsal.
