output "alb_dns_name" {
  value       = module.compute.alb_dns_name
  description = "The public DNS name of the ALB"
}

output "assets_bucket_name" {
  value       = module.storage.assets_bucket_name
  description = "The name of the assets S3 bucket"
}

output "backups_bucket_name" {
  value       = module.storage.backups_bucket_name
  description = "The name of the backups S3 bucket"
}

output "sns_topic_arn" {
  value       = module.monitoring.sns_topic_arn
  description = "The ARN of the SNS topic for alerts"
}

output "github_oidc_provider_arn" {
  value       = module.github_oidc.oidc_provider_arn
  description = "ARN of the IAM OIDC provider for GitHub Actions"
}

output "github_terraform_plan_role_arn" {
  value       = module.github_oidc.terraform_plan_role_arn
  description = "ARN of the IAM role for terraform plan — copy this into the TERRAFORM_PLAN_ROLE_ARN repository variable"
}

output "github_terraform_apply_role_arn" {
  value       = module.github_oidc.terraform_apply_role_arn
  description = "ARN of the IAM role for terraform apply — copy this into the TERRAFORM_APPLY_ROLE_ARN repository variable"
}
