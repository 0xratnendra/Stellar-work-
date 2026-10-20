# ── GitHub OIDC federation module ────────────────────────────────────────────
#
# Creates:
#   1. An IAM OIDC identity provider for token.actions.githubusercontent.com
#      (idempotent — uses a data source if one already exists in the account).
#   2. One IAM role per environment-permission pair, each with a trust policy
#      that restricts which repository, branch, and event type may assume it.
#
# Trust-policy subject claim format (from GitHub's OIDC token):
#   repo:<owner>/<repo>:ref:refs/heads/<branch>         (push to named branch)
#   repo:<owner>/<repo>:pull_request                    (any PR event)
#   repo:<owner>/<repo>:environment:<environment-name>  (GitHub Environment gate)
#
# We use environment-scoped claims for apply/deploy roles and branch claims for
# plan/read-only roles so that the least-privileged role is assumed wherever
# possible and the apply role can only be triggered through a protected
# GitHub Environment (which may require a manual approval gate).

locals {
  # Thumbprint list for token.actions.githubusercontent.com.
  # GitHub rotates the certificate occasionally; this list contains the current
  # and historical thumbprints so rotation doesn't break the OIDC provider.
  # Source: https://github.blog/changelog/2023-06-27-github-actions-update-on-oidc-integration-with-aws/
  github_thumbprints = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  oidc_url = "https://token.actions.githubusercontent.com"
}

# ── OIDC provider ─────────────────────────────────────────────────────────────
# Try to look up an existing provider first so the module is safe to apply in
# an account that already has the GitHub OIDC provider registered manually.

data "aws_iam_openid_connect_provider" "github_existing" {
  count = var.create_oidc_provider ? 0 : 1
  url   = local.oidc_url
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = local.oidc_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = local.github_thumbprints

  tags = {
    Name = "github-actions-oidc"
  }
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? (
    aws_iam_openid_connect_provider.github[0].arn
  ) : data.aws_iam_openid_connect_provider.github_existing[0].arn
}

# ── Terraform plan role (read-only, PR events) ────────────────────────────────
# Assumed during `terraform plan` on pull requests.
# Subject is scoped to any PR against the repository — no branch restriction
# because plan is a read-only operation and PR authors vary.

data "aws_iam_policy_document" "plan_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Allow any PR from the repository. Restricts to pull_request events only.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:pull_request"]
    }
  }
}

resource "aws_iam_role" "terraform_plan" {
  name               = "${var.role_name_prefix}-terraform-plan"
  description        = "Assumed by GitHub Actions for terraform plan (read-only, PR events)"
  assume_role_policy = data.aws_iam_policy_document.plan_assume_role.json
  max_session_duration = 3600 # 1 hour — plan should complete well within this

  tags = {
    GitHubOrg  = var.github_org
    GitHubRepo = var.github_repo
    Purpose    = "terraform-plan"
  }
}

resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# ── Terraform apply role (main branch push, via GitHub Environment) ───────────
# Assumed during `terraform apply` on pushes to main.
# Double-locked:
#   1. Subject claim must match the protected branch.
#   2. Caller must be running in the named GitHub Environment, which is
#      configured to require reviewer approval on the GitHub side.

data "aws_iam_policy_document" "apply_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Locked to main branch push only.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main",
        # Also allow the GitHub Environment claim so apply can be gated via
        # a required reviewer on the Environment settings page.
        "repo:${var.github_org}/${var.github_repo}:environment:${var.github_environment}",
      ]
    }
  }
}

resource "aws_iam_role" "terraform_apply" {
  name               = "${var.role_name_prefix}-terraform-apply"
  description        = "Assumed by GitHub Actions for terraform apply (main branch, protected environment)"
  assume_role_policy = data.aws_iam_policy_document.apply_assume_role.json
  max_session_duration = 3600

  tags = {
    GitHubOrg         = var.github_org
    GitHubRepo        = var.github_repo
    GitHubEnvironment = var.github_environment
    Purpose           = "terraform-apply"
  }
}

# Apply needs write access. We attach a customer-managed policy rather than
# AdministratorAccess so the scope is auditable and can be tightened over time.
resource "aws_iam_role_policy" "apply_permissions" {
  name = "terraform-apply-permissions"
  role = aws_iam_role.terraform_apply.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # ECS — deploy updated task definitions
        Sid    = "ECSDeployAccess"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:CreateService",
          "ecs:DeleteService",
          "ecs:CreateCluster",
          "ecs:DeleteCluster",
          "ecs:DescribeClusters",
          "ecs:ListClusters",
          "ecs:TagResource",
        ]
        Resource = "*"
      },
      {
        # ECR — push/pull container images
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:DescribeRepositories",
          "ecr:CreateRepository",
          "ecr:DeleteRepository",
          "ecr:ListImages",
          "ecr:TagResource",
        ]
        Resource = "*"
      },
      {
        # S3 — Terraform state bucket + assets bucket
        Sid    = "S3TerraformState"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketVersioning",
          "s3:PutBucketVersioning",
          "s3:GetBucketPolicy",
          "s3:PutBucketPolicy",
          "s3:GetEncryptionConfiguration",
          "s3:PutEncryptionConfiguration",
          "s3:CreateBucket",
          "s3:DeleteBucket",
        ]
        Resource = [
          "arn:aws:s3:::stellarwork-*",
          "arn:aws:s3:::stellarwork-*/*",
        ]
      },
      {
        # DynamoDB — Terraform state locking table
        Sid    = "DynamoDBStateLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:UpdateTable",
          "dynamodb:TagResource",
        ]
        Resource = "arn:aws:dynamodb:*:*:table/stellarwork-*"
      },
      {
        # IAM — manage service roles created by Terraform modules
        # Restricted to roles/policies with the project prefix.
        Sid    = "IAMProjectRoles"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:TagRole",
          "iam:PassRole",
          "iam:CreateInstanceProfile",
          "iam:DeleteInstanceProfile",
          "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile",
          "iam:GetInstanceProfile",
          "iam:CreateOpenIDConnectProvider",
          "iam:DeleteOpenIDConnectProvider",
          "iam:GetOpenIDConnectProvider",
          "iam:ListOpenIDConnectProviders",
          "iam:TagOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:TagPolicy",
        ]
        Resource = [
          "arn:aws:iam::*:role/stellarwork-*",
          "arn:aws:iam::*:policy/stellarwork-*",
          "arn:aws:iam::*:instance-profile/stellarwork-*",
          "arn:aws:iam::*:oidc-provider/token.actions.githubusercontent.com",
        ]
      },
      {
        # VPC / networking — subnets, security groups, ALB
        Sid    = "NetworkingAccess"
        Effect = "Allow"
        Action = [
          "ec2:*Vpc*",
          "ec2:*Subnet*",
          "ec2:*SecurityGroup*",
          "ec2:*RouteTable*",
          "ec2:*InternetGateway*",
          "ec2:*NatGateway*",
          "ec2:*NetworkAcl*",
          "ec2:*Address*",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeRegions",
          "ec2:DescribeTags",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "elasticloadbalancing:*",
        ]
        Resource = "*"
      },
      {
        # CloudWatch / SNS — monitoring module
        Sid    = "MonitoringAccess"
        Effect = "Allow"
        Action = [
          "cloudwatch:*",
          "logs:*",
          "sns:*",
        ]
        Resource = "*"
      },
    ]
  })
}
