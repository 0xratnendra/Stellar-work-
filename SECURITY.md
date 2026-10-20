# Security Policy

## Supported Versions

Only the latest release and the current `main` branch receive security patches. Older versions and unmaintained branches are not supported.

| Version | Supported          |
| ------- | ------------------ |
| Latest release (main branch) | :white_check_mark: |
| Older versions / tags        | :x:                |

## Reporting a Vulnerability

If you discover a security issue, please report it privately and do not open a public issue.

- **Email:** bandanadivya.opensource@gmail.com
- **PGP Key:** Not available at this time — use encrypted email if possible, or request a secure channel in your initial report.
- **Include:** affected component, version/commit, impact severity, reproduction steps, and any proof-of-concept details.
- If available, include suggested remediation or mitigation guidance.

## Disclosure Process

- We will acknowledge receipt of a report within **3 business days**.
- We will provide an initial severity assessment and next-step plan within **7 business days**.
- We will coordinate disclosure timing with the reporter after a fix or mitigation is available.
- Please avoid sharing exploit details publicly until coordinated disclosure is complete.

## Bug Bounty

We do not currently offer a monetary bug bounty program. However, we publicly acknowledge responsible disclosures in release notes (with the reporter's consent) and welcome contributions to fix validated issues.

## Scope Guidance

Please report vulnerabilities affecting:

- Soroban contract logic and state transition safety
- Frontend auth/session assumptions or wallet interaction risks
- Dependency or supply-chain issues that impact this repository

Out-of-scope examples:

- Social engineering attempts
- Denial-of-service scenarios without a practical exploit path
- Reports requiring non-default insecure local configuration

---

## Container Scanning

The frontend Docker image (`frontend/Dockerfile`, base `node:20-alpine`) is scanned for known CVEs using [Trivy](https://github.com/aquasecurity/trivy) on every pull request that touches the Dockerfile, package manifests, or compose configuration, and again on a weekly schedule (Mondays 04:00 UTC).

Scan results are uploaded to the repository **Security → Code scanning alerts** tab in SARIF format. Critical findings that are not allowlisted also open a GitHub Issue labelled `security` + `container-scan`.

### How scanning works

| Trigger | Workflow | Action on finding |
|---------|----------|-------------------|
| PR / push touching `frontend/Dockerfile`, `package.json`, `docker-compose.yml` | `container-scan.yml` | Fails the CI job; posts a PR comment listing unapproved criticals |
| Weekly schedule (Mon 04:00 UTC) + post-merge pushes | `container-scan-scheduled.yml` | Fails the job; opens or updates a GitHub Issue |
| Any trigger | Both | Uploads SARIF to Security tab |

Trivy is configured with:
- **Severity gate**: `CRITICAL` and `HIGH` only
- **Scope**: OS packages + language-level dependencies inside the image
- **Unfixed CVEs**: ignored — they cannot be remediated by upgrading and would create permanent noise

### Adding an allowlist entry

When a finding cannot be remediated immediately (no upstream fix exists, fix introduces a breaking change, remediation is in progress), it can be temporarily accepted by adding an entry to **`.github/container-scan-allowlist.json`**.

**Required fields:**

```json
{
  "id": "CVE-2024-12345",
  "packageName": "some-package",
  "reason": "No fix available in node:20-alpine as of 2025-01-15. Tracking upstream issue: https://...",
  "expiresAt": "2025-04-15",
  "addedBy": "your-github-username",
  "addedAt": "2025-01-15"
}
```

**Rules:**
- `expiresAt` must be no more than **90 days** from `addedAt`. The enforcement script treats expired entries as unapproved.
- `reason` must be non-empty and include a link to the upstream issue or patch timeline where possible.
- The PR adding the entry requires a second reviewer to approve.
- When the fix becomes available, remove the entry and rebuild — do not simply extend `expiresAt` without re-assessing.

The enforcement script (`.github/scripts/check-trivy-allowlist.mjs`) validates these fields on every scan run and will fail the job if any entry is missing required fields or has passed its expiry date.
