# What was verified, and what was not

This directory has never been applied. There is no cloud account behind this
solution and no `terraform` binary on the machine it was written on, so:

| Claim | Status |
|---|---|
| The configuration is valid HCL that terraform accepts | **Not verified.** No binary to run `terraform validate` or `terraform fmt -check` |
| A plan against an untouched environment shows no changes | **Not verified.** Needs an applied environment |
| Staging can be destroyed and rebuilt from this repository, timed | **Not verified.** Needs an account |
| The database refuses a connection from outside its security group | **Not verified against AWS.** The rule that produces it is one line in `main.tf` and is explained there |
| No long lived access key exists in this repository or environment | **Verified.** `tests/test_platform.py` scans every tracked file for key shaped strings and checks the environment, and it runs in the gate |
| The intermediate states of the expand and contract migration are safe | **Verified**, on PostgreSQL 18.6, by running the six deploys and both code versions against a real database. See `migrations/` |
| Blue green refuses to switch to a version that is not ready | **Verified**, by running it. See `deploy/rehearsal.py` |
| A rollback completes in the stated time | **Verified**, five runs, both paths. See the README |

Writing it down this way is the point of the file. An infrastructure directory
with no note like this implies it works, and a reviewer has no way to know
otherwise until the first apply.

## What a reader should do with it

Read it as a design under review rather than as a running system. Specifically:

- The security group referring to another security group rather than to a CIDR
  block, in `main.tf`, is the single most important line in the directory.
- The IAM policy in `iam.tf` is scoped to one secret, one key, one bucket prefix
  and two queues, with the one unavoidable wildcard narrowed by condition and
  commented. That shape is what a security review looks for.
- The billing alarm in `billing.tf` exists before anything billable and is a
  dependency of the VPC. That ordering is unusual on purpose.

## How to check it before trusting it

```bash
terraform fmt -check -recursive        # formatting, which also catches syntax
terraform init -backend=false          # providers, without touching state
terraform validate                     # types, references, required arguments
tflint --minimum-failure-severity=warning
checkov -d . --compact                 # policy checks: public buckets, open groups

# Then, and only then, against an account:
terraform plan -var-file=staging.tfvars
```

`terraform validate` catches most of what is likely wrong here: a mistyped
attribute, a resource argument that moved between provider versions, a reference
to something that does not exist. None of it has been run, and pretending
otherwise would be worse than the gap.
