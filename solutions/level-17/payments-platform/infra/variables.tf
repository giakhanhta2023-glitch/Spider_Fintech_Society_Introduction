# Sizing is a variable, so staging and production are the same code with
# different numbers. Two copies of the infrastructure that drift apart is the
# usual alternative, and the drift is discovered during the incident that
# staging did not reproduce.

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type        = string
  description = "local, staging or production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

# ------------------------------------------------------------------- sizing
variable "database_instance_class" {
  type        = string
  description = "Staging does not need production hardware, and production does"
  default     = "db.t4g.medium"
}

variable "database_storage_gb" {
  type    = number
  default = 100
}

variable "database_multi_az" {
  type        = bool
  description = "A standby in another availability zone. Doubles the bill"
  default     = false
}

variable "service_desired_count" {
  type    = number
  default = 2
}

variable "service_cpu" {
  type        = number
  description = "CPU units. 1024 is one vCPU"
  default     = 1024
}

variable "service_memory_mb" {
  type    = number
  default = 2048
}

# ------------------------------------------------------------------ budgets
variable "monthly_budget_dollars" {
  type        = number
  description = "The alarm threshold, created before any billable resource"
  default     = 200
}

variable "alert_email" {
  type        = string
  description = "Where the billing alarm goes. A person, not a shared inbox nobody reads"
}

# ---------------------------------------------------------------- retention
variable "log_retention_days" {
  type        = number
  description = <<-EOT
    Thirty days by default rather than "never expire", which is the console
    default and the reason log bills grow without anybody changing anything.
    Level 16 measured the volume: at 200 requests a second and six lines each,
    unsampled logs are 15.8 GB a day.
  EOT
  default     = 30
}
