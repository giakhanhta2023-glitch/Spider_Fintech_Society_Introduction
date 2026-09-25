# Remote state, and the two things about it that bite.
#
# **State is shared or it is useless.** Local state means the second engineer to
# run apply does not know what the first one created, and terraform helpfully
# offers to create it again.
#
# **State contains secrets in plaintext.** Every generated password, every
# connection string, every value a provider returned. It is not encrypted by
# terraform and it is not redacted. So: a bucket with encryption on, versioning
# on, public access blocked, and access limited to the people who already have
# production credentials. Treat the state bucket exactly as you would a database
# backup, because that is what it is.
#
# The bucket and the lock table are created once, by hand, before terraform
# manages anything. A bootstrap that manages its own state is a chicken and egg
# problem with a bad error message.

terraform {
  required_version = "~> 1.9"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Pinned to a minor version. A provider major upgrade rewrites resources,
      # and discovering that during an incident is not the moment for it.
      version = "~> 5.60"
    }
  }

  backend "s3" {
    bucket = "finquest-payments-tfstate"
    key    = "payments-platform/terraform.tfstate"
    region = "us-east-1"

    # Locking, so two applies cannot interleave. Without it, two pipelines
    # running at once produce state that describes neither reality.
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      # Every resource carries these. Untagged resources are how a bill becomes
      # unattributable, and how nobody can tell which environment owns the
      # database costing $1,459 a month.
      Application = "payments-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "github.com/finquest/payments-platform"
    }
  }
}
