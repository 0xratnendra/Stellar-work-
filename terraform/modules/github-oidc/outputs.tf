output "oidc_provider_arn" {
  description = "ARN of the IAM OIDC identity provider for token.actions.githubusercontent.com"
  value       = local.oidc_provider_arn
}

output "terraform_plan_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions for terraform plan (PR events, read-only)"
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions for terraform apply (main branch, protected environment)"
  value       = aws_iam_role.terraform_apply.arn
}

output "terraform_plan_role_name" {
  description = "Name of the plan IAM role"
  value       = aws_iam_role.terraform_plan.name
}

output "terraform_apply_role_name" {
  description = "Name of the apply IAM role"
  value       = aws_iam_role.terraform_apply.name
}
