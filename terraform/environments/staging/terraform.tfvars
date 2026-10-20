environment     = "staging"
aws_region      = "us-east-1"
vpc_cidr        = "10.10.0.0/16"
app_count       = 2
email_recipient = "staging-alerts@stellarwork.io"

# ── GitHub OIDC ───────────────────────────────────────────────────────────────
github_org         = "stellarwork-io"
github_repo        = "stellarwork"
github_environment = "staging"

# If staging lives in a separate AWS account from dev, set true.
# If it shares an account with dev, set false — the provider already exists.
create_oidc_provider = true
