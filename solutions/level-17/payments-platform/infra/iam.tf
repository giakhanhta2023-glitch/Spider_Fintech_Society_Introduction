# Roles, not keys. Then the narrowest policy that works.
#
# There is no access key anywhere in this repository, in the pipeline, or in
# anybody's shell profile. Two mechanisms replace them:
#
# **The task role**, which the container assumes automatically. Credentials are
# fetched from the container's metadata endpoint, are valid for minutes, and are
# rotated without anybody doing anything.
#
# **OpenID Connect from the pipeline**, so a GitHub Actions run exchanges its own
# short lived token for a role. This is the one that removes the last long lived
# key most teams have: the deploy key in the repository secrets.
#
# A long lived key is a password with no expiry, no owner and no audit trail, and
# it ends up in a laptop backup, a screenshot or a public commit. The mechanisms
# below take slightly longer to set up once, and then there is nothing to leak.

# ------------------------------------------------------------- the task role
data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

# The narrowest policy that works, written by starting from nothing and adding
# the one action that failed. Every statement here is scoped to a specific
# resource, and the two comments mark the places where a wildcard is normally
# added at six in the evening to make an error message go away.
data "aws_iam_policy_document" "task" {
  # One secret, by ARN. Not secretsmanager:* and not "arn:aws:secretsmanager:*",
  # both of which grant read access to every secret in the account, including
  # the ones belonging to other teams.
  statement {
    sid       = "ReadOwnDatabaseSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database.arn]
  }

  # One key, and only the two operations envelope encryption needs. Not
  # kms:Decrypt on every key, and not kms:* on one: the vault from level 15 needs
  # GenerateDataKey and Decrypt, and nothing else. It explicitly does not need
  # kms:ScheduleKeyDeletion, which is the one that would end the company.
  statement {
    sid = "EnvelopeEncryptionOnOneKey"
    actions = [
      "kms:GenerateDataKey",
      "kms:Decrypt",
    ]
    resources = [aws_kms_key.cards.arn]
  }

  # One bucket, one prefix. `arn:aws:s3:::bucket/*` would grant access to every
  # object including other environments' settlement files.
  statement {
    sid = "SettlementFilesForThisEnvironmentOnly"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.settlement.arn}/${var.environment}/*"]
  }

  statement {
    sid = "OwnQueueOnly"
    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.payouts.arn, aws_sqs_queue.payouts_dead_letter.arn]
  }

  # Writing metrics needs a wildcard resource, because CloudWatch has no
  # resource ARN for PutMetricData. That is a real exception rather than
  # laziness, so it is narrowed by condition instead, and the comment says why
  # the wildcard is here. An unexplained wildcard in a review is a rejection.
  statement {
    sid       = "PublishMetricsInOneNamespace"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["payments/${var.environment}"]
    }
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${local.name}-task"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ------------------------------------------------ the pipeline, without keys
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to one repository and one branch. Without the `sub` condition, any
    # GitHub Actions run in the world can assume this role, which has happened to
    # real companies and is the single most common mistake in this pattern.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:finquest/payments-platform:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
}

# ------------------------------------------------------- the card master key
resource "aws_kms_key" "cards" {
  description             = "Envelope encryption master key for the card vault"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  # This is the resource whose loss is unrecoverable: every sealed card row in
  # the vault is unreadable without it. Thirty days is the maximum window, and
  # the key policy is where an accidental delete is actually prevented.
}

resource "aws_kms_alias" "cards" {
  name          = "alias/${local.name}-cards"
  target_key_id = aws_kms_key.cards.key_id
}

resource "aws_s3_bucket" "settlement" {
  bucket = "${local.name}-settlement-files"
}

resource "aws_s3_bucket_public_access_block" "settlement" {
  bucket                  = aws_s3_bucket.settlement.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "settlement" {
  bucket = aws_s3_bucket.settlement.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.cards.arn
    }
  }
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "deploy_role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "Assumed by the pipeline through OIDC. There is no access key"
}
