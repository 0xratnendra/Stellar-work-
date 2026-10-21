environment     = "dev"
aws_region      = "us-east-1"
vpc_cidr        = "10.0.0.0/16"
app_count       = 1
email_recipient = "dev-alerts@stellarwork.io"

# ── GitHub OIDC ───────────────────────────────────────────────────────────────
# Replace these placeholders with your actual GitHub org and repo name before
# running terraform apply for the first time in this environment.
# After apply, copy the role ARNs from terraform output into GitHub Actions
# repository variables (Settings → Variables):
#   TERRAFORM_PLAN_ROLE_ARN   ← github_terraform_plan_role_arn
#   TERRAFORM_APPLY_ROLE_ARN  ← github_terraform_apply_role_arn
github_org         = "stellarwork-io"
github_repo        = "stellarwork"
github_environment = "development"

# Dev typically shares an AWS account with no prior OIDC provider — set true
# on first apply, then set false if you later add staging to the same account.
create_oidc_provider = true
