# AWS OIDC Federation for GitHub Actions

This document explains how GitHub Actions workflows authenticate to AWS without
storing static access keys, how the trust policies are designed, how to audit
which roles are being assumed, and what to do if something goes wrong.

---

## Background — why static keys are dangerous

Static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pairs:

- Do not expire automatically
- Are valid from any IP, any time, in any workflow
- Grant broad access if leaked to a fork PR, a log scraper, or a dependency
- Require a manual rotation process that is easy to skip

GitHub OIDC federation replaces them with short-lived STS tokens (≤ 1 hour)
that are tied to a specific repository, branch, and GitHub Environment. A
leaked token is automatically worthless within the hour and cannot be requested
by anything other than the exact workflow job that earned it.

---

## Architecture

```
GitHub Actions runner
  │
  │  1. Request OIDC JWT from GitHub IdP
  ▼
token.actions.githubusercontent.com
  │
  │  2. Present JWT to AWS STS
  ▼
sts:AssumeRoleWithWebIdentity
  │
  │  3. Trust policy validates claims
  │     - aud  == sts.amazonaws.com
  │     - sub  == repo:<org>/<repo>:ref:refs/heads/main   (apply)
  │             or repo:<org>/<repo>:pull_request          (plan)
  │             or repo:<org>/<repo>:environment:<name>    (apply, double-lock)
  │
  │  4. Return temporary credentials (max 1 h)
  ▼
GitHub Actions step
  (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN set as env vars
   for the duration of the job — never stored, never logged)
```

---

## IAM roles

Two roles are created per environment by the `terraform/modules/github-oidc`
module. After the first `terraform apply` you can read their ARNs from the
outputs:

```bash
terraform output github_terraform_plan_role_arn
terraform output github_terraform_apply_role_arn
```

Copy these ARNs into GitHub repository **Variables** (not Secrets — they are
not sensitive):

| Variable name | Value |
|---|---|
| `TERRAFORM_PLAN_ROLE_ARN` | `arn:aws:iam::<account>:role/stellarwork-<env>-terraform-plan` |
| `TERRAFORM_APPLY_ROLE_ARN` | `arn:aws:iam::<account>:role/stellarwork-<env>-terraform-apply` |

### Plan role

- **Name**: `stellarwork-<env>-terraform-plan`
- **Permissions**: AWS managed `ReadOnlyAccess`
- **Trust policy subject**: `repo:<org>/<repo>:pull_request`
- **Used by**: `terraform.yml` plan job, `deploy-preview.yml`
- **Max session**: 30 minutes

The plan role can only be assumed during a pull request event. Pushing directly
to `main` does not match the `pull_request` subject claim and STS will reject
the assumption request.

### Apply role

- **Name**: `stellarwork-<env>-terraform-apply`
- **Permissions**: scoped inline policy (ECS, ECR, S3, DynamoDB, IAM project
  resources, networking, CloudWatch) — see `modules/github-oidc/main.tf`
- **Trust policy subject**: `repo:<org>/<repo>:ref:refs/heads/main` **or**
  `repo:<org>/<repo>:environment:<name>` (double-lock)
- **Used by**: `terraform.yml` apply job, `deploy-production.yml`
- **Max session**: 1 hour

The double-lock means both conditions must be satisfiable:
1. The OIDC token must carry the `main` branch ref claim.
2. The token must carry the GitHub Environment claim, which is only issued
   after the Environment's required reviewers have approved the job.

Removing a reviewer from the Environment settings page does not grant broader
trust — the IAM role's trust policy is the authoritative gate.

---

## One-time bootstrap

The OIDC module must be applied once using static credentials because it
creates the IAM resources that replace them. This is a one-time operation.

```bash
# 1. Authenticate with a human IAM user or SSO session that has IAM write access.
aws sso login --profile stellarwork-admin   # or export AWS_PROFILE=...

# 2. Apply just the OIDC module (targeting avoids touching other resources).
cd terraform
terraform init
terraform apply \
  -target=module.github_oidc \
  -var-file="environments/prod/terraform.tfvars"

# 3. Read the role ARNs from outputs.
terraform output github_terraform_plan_role_arn
terraform output github_terraform_apply_role_arn

# 4. Set them as repository Variables in GitHub:
#    Settings → Secrets and variables → Actions → Variables tab
#    TERRAFORM_PLAN_ROLE_ARN  = <plan role ARN>
#    TERRAFORM_APPLY_ROLE_ARN = <apply role ARN>

# 5. Delete the static key secrets from GitHub:
#    Settings → Secrets and variables → Actions
#    Delete: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# 6. Deactivate and delete the IAM user / access key in AWS IAM.
#    Never leave the old key active alongside the OIDC roles.
```

---

## Deleting the old static credentials

After verifying that at least one plan and one apply job have succeeded with
OIDC, revoke the static key:

1. **GitHub**: Settings → Secrets and variables → Actions → delete
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
2. **AWS IAM console**: navigate to the IAM user → Security credentials tab →
   select the access key → Actions → Deactivate → wait 24 h → Delete.
3. Run `git log --all -S 'AWS_ACCESS_KEY_ID'` locally to confirm the key was
   never committed to history. If it was, rotate immediately via the AWS
   console and run a secrets-scanning remediation.

---

## Auditing assumed roles

### CloudTrail (recommended)

Every `AssumeRoleWithWebIdentity` call is recorded in CloudTrail under
`sts.amazonaws.com`. To find all OIDC assumptions for this repo:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --start-time "$(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%SZ')" \
  --query "Events[?contains(CloudTrailEvent, 'token.actions.githubusercontent.com')].[EventTime,Username,CloudTrailEvent]" \
  --output table
```

Each event record includes:
- `principalId` — the GitHub Actions runner identity
- `roleArn` — which role was assumed
- `subjectFromWebIdentityToken` — the exact `sub` claim (repo + branch/env)
- `sourceIPAddress` — the GitHub-hosted runner IP range

### IAM Access Analyzer

Enable IAM Access Analyzer in the AWS account and set up a finding for
external access to the OIDC roles. Any assumption from outside the expected
`token.actions.githubusercontent.com` issuer will generate a finding.

### GitHub Actions audit log

GitHub's audit log (Settings → Audit log) records every workflow trigger,
including which actor initiated a push to `main` that led to an apply run.
Filter by `workflows.completed_workflow_run` to correlate with CloudTrail.

---

## Trust policy reference

The trust policy on the apply role as rendered by Terraform:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:sub": [
            "repo:stellarwork-io/stellarwork:ref:refs/heads/main",
            "repo:stellarwork-io/stellarwork:environment:production"
          ]
        }
      }
    }
  ]
}
```

The `StringEquals` operator (not `StringLike`) prevents wildcard bypass. A
token claiming `ref:refs/heads/main-evil` would not match.

---

## Adding a new environment

1. Add a new `terraform.tfvars` file under `terraform/environments/<name>/`
   with the `github_environment` and `create_oidc_provider` variables set
   appropriately (see existing files for reference).
2. If the new environment is in the **same AWS account** as an existing one,
   set `create_oidc_provider = false` — the provider is account-scoped and
   cannot be created twice.
3. Apply with `-var-file="environments/<name>/terraform.tfvars"`.
4. Create the matching GitHub Environment under Settings → Environments with a
   required reviewer.
5. Add `TERRAFORM_PLAN_ROLE_ARN` and `TERRAFORM_APPLY_ROLE_ARN` as
   environment-scoped variables (not repository-level) so each environment's
   workflows assume their own roles.

---

## Troubleshooting

### `Error: Not authorized to perform sts:AssumeRoleWithWebIdentity`

- Confirm `TERRAFORM_PLAN_ROLE_ARN` / `TERRAFORM_APPLY_ROLE_ARN` variables
  are set at the correct scope (repository variable vs environment variable).
- Confirm the GitHub Environment name in `terraform.tfvars` exactly matches
  the environment name in the workflow `environment:` field — the claim is
  case-sensitive.
- Confirm `create_oidc_provider` is correct for the account — if the provider
  does not exist the role ARN will be invalid.

### `Error: The security token included in the request is expired`

The STS session expired mid-job. Increase `role-duration-seconds` in the
`configure-aws-credentials` step (max 3600 for these roles).

### Plan succeeds but apply is rejected

The apply role's trust policy requires both the `main` branch claim AND the
`production` environment claim. Confirm:
1. The job has `environment: production` in the workflow file.
2. The `production` environment exists in GitHub Settings → Environments.
3. The required reviewer has approved the pending deployment.
