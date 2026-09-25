# The first resource in the repository, and the reason it is in its own file.
#
# A NAT gateway costs about $33 a month before it moves a byte. An idle database
# charges by the hour whether or not anything connects. A load balancer bills for
# existing. None of that shows up until the invoice, and the first surprising
# cloud bill is a rite of passage nobody needs to have.
#
# So the budget alarm goes in before anything that can spend money, and
# everything else in this configuration depends on it. That dependency is
# deliberate and slightly unusual: it means `terraform apply` cannot create a
# billable resource in an account that has no alarm.

resource "aws_sns_topic" "alerts" {
  name = "payments-${var.environment}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_budgets_budget" "monthly" {
  name         = "payments-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_dollars)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Three thresholds rather than one. 80% of the way through the month is a
  # conversation; 100% forecast is a decision; 100% actual is already spent.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
    subscriber_email_addresses = [var.alert_email]
  }
}

# A daily anomaly detector as well as a monthly budget, because a budget tells
# you at the end of the month and this tells you the next morning. The failure
# mode it catches is the one that actually happens: something left running by
# accident, or a loop calling a paid API.
resource "aws_ce_anomaly_monitor" "service" {
  name              = "payments-${var.environment}-by-service"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "daily" {
  name      = "payments-${var.environment}-daily-anomalies"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.service.arn]

  subscriber {
    type    = "EMAIL"
    address = var.alert_email
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = ["20"]
    }
  }
}
