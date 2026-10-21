variable "github_org" {
  type        = string
  description = "GitHub organisation or user name that owns the repository (e.g. 'stellarwork-io')"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name without the owner prefix (e.g. 'stellarwork')"
}

variable "github_environment" {
  type        = string
  description = <<-EOT
    Name of the GitHub Actions Environment that the apply role is restricted to.
    Configure this environment in the repository Settings → Environments with
    a required reviewer to enforce a manual approval gate before apply runs.
  EOT
}

variable "role_name_prefix" {
  type        = string
  description = <<-EOT
    Prefix for IAM role names, e.g. 'stellarwork-prod'.
    Full role names will be '<prefix>-terraform-plan' and '<prefix>-terraform-apply'.
  EOT
}

variable "create_oidc_provider" {
  type        = bool
  description = <<-EOT
    Set to true to create the IAM OIDC identity provider for
    token.actions.githubusercontent.com. Set to false if the provider
    already exists in this AWS account (each account can have only one).
  EOT
  default     = true
}
