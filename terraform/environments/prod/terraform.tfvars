environment     = "prod"
aws_region      = "us-east-1"
vpc_cidr        = "10.20.0.0/16"
app_count       = 3
email_recipient = "alerts@stellarwork.io"

# ── GitHub OIDC ───────────────────────────────────────────────────────────────
github_org         = "stellarwork-io"
github_repo        = "stellarwork"

# Must match a GitHub Environment configured in Settings → Environments with
# a required reviewer. The apply IAM role's trust policy checks this claim,
# so apply cannot run without the manual gate being passed.
github_environment = "production"

# Production has its own dedicated AWS account — always true here.
create_oidc_provider = true
