# The network, the database, the cache and the queue.
#
# Two rules run through all of it.
#
# **The database has no public address.** Not a strong password on a public
# endpoint: no endpoint. It lives in a private subnet and its security group
# accepts traffic from exactly one source, which is the service's security group
# rather than a range of addresses. Referring to a security group instead of a
# CIDR block means the rule stays correct when the service moves.
#
# **Everything depends on the billing alarm.** See billing.tf.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "payments-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}

# ------------------------------------------------------------------ network
resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags       = { Name = local.name }
  depends_on = [aws_budgets_budget.monthly]
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = { Name = "${local.name}-private-${count.index}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

# One NAT gateway in staging, two in production. This is the line people are
# surprised by: about $33 a month each before any traffic, plus a charge per
# gigabyte processed in both directions. Two of them is the price of surviving
# the loss of one availability zone, and in staging that is not worth paying.
resource "aws_eip" "nat" {
  count  = var.environment == "production" ? 2 : 1
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  count         = var.environment == "production" ? 2 : 1
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "private" {
  count  = length(aws_subnet.private)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[min(count.index, length(aws_nat_gateway.main) - 1)].id
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# --------------------------------------------------------- security groups
resource "aws_security_group" "service" {
  name        = "${local.name}-service"
  description = "The payments service tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Outbound to the card network, the vault and the key service"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "PostgreSQL, reachable from the service and from nothing else"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "The service, by security group rather than by address range"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    # This one line is the level's test "the database refuses a connection from
    # outside its security group". A CIDR block here, even a private one, admits
    # every instance in the VPC including the one somebody started to debug
    # something in 2024.
    security_groups = [aws_security_group.service.id]
  }

  # No egress rules at all. A database has no business opening connections, and
  # the default deny is what turns a SQL injection into a dead end rather than
  # into an exfiltration path.
}

# ----------------------------------------------------------------- database
resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "random_password" "database" {
  length  = 32
  special = false
}

# The password goes to the secret manager, and the service reads it from there at
# start. It is still in the terraform state in plaintext, which is why the state
# bucket is treated as a production secret store. The alternative is to have the
# secret manager generate it and never let terraform see it, which is better and
# is one indirection more than this file has room to explain.
resource "aws_secretsmanager_secret" "database" {
  name                    = "${local.name}/database"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = "payments"
    password = random_password.database.result
  })
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.database_instance_class

  allocated_storage     = var.database_storage_gb
  max_allocated_storage = var.database_storage_gb * 4
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "payments"
  username = "payments"
  password = random_password.database.result

  # The whole point.
  publicly_accessible    = false
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]

  multi_az                = var.database_multi_az
  backup_retention_period = var.environment == "production" ? 14 : 1
  backup_window           = "03:00-04:00"

  # Deletion protection in production, and not in staging, because staging is
  # destroyed and rebuilt on purpose and protection would block the exercise.
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  performance_insights_enabled = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Applied during the maintenance window rather than immediately, so a
  # parameter change does not restart the database in the middle of the day.
  apply_immediately = false
}

# -------------------------------------------------------------------- cache
resource "aws_elasticache_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "cache" {
  name        = "${local.name}-cache"
  description = "Redis, for the level 14 limiter and the single flight cache"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = local.name
  description          = "Rate limiter and cache"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_clusters   = var.environment == "production" ? 2 : 1
  port                 = 6379

  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.cache.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = var.environment == "production"
}

# -------------------------------------------------------------------- queue
# The dead letter queue is created first and referenced by the main one, because
# a queue without one loses a poison message forever or retries it until the end
# of time. Level 11's lesson, as infrastructure.
resource "aws_sqs_queue" "payouts_dead_letter" {
  name                      = "${local.name}-payouts-dlq"
  message_retention_seconds = 1209600 # fourteen days, the maximum
}

resource "aws_sqs_queue" "payouts" {
  name                       = "${local.name}-payouts"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payouts_dead_letter.arn
    maxReceiveCount     = 5
  })
}

# ----------------------------------------------------------------- outputs
output "database_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "Private. Resolvable only inside the VPC"
}

output "database_secret_arn" {
  value       = aws_secretsmanager_secret.database.arn
  description = "What the task role is allowed to read, and nothing else"
}

output "queue_url" {
  value = aws_sqs_queue.payouts.url
}
