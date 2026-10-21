# Security Best Practices & Threat Model

## Threat Model

### Assets
- **User funds**: Native tokens and custom assets held in escrow contracts.
- **Private keys**: Stellar wallet secret keys used to sign transactions.
- **Personal data**: User profiles, job descriptions, and messaging content.
- **Smart contract state**: Escrow balances, job statuses, access control lists.

### Threat Actors
- **Malicious users**: Exploit contract logic to steal funds or disrupt jobs.
- **Compromised keys**: Attacker gains access to a user's wallet secret key.
- **Frontend attackers**: Inject malicious code or phish for signatures.
- **Network adversaries**: Intercept or manipulate blockchain transactions.

### Attack Vectors
| Vector | Description | Risk |
|--------|-------------|------|
| Phishing | Fake StellarWork site steals credentials and signing requests | High |
| XSS | Malicious script injected into job descriptions or messages | High |
| Reentrancy | Recursive calls drain contract before state updates | Medium |
| Social Engineering | Attacker poses as client/freelancer to redirect payments | Medium |
| Front-running | Attacker observes pending tx and submits with higher gas | Low |
| Upgrade Abuse | Malicious contract upgrade via compromised admin key | Critical |

## Smart Contract Security

### Authorization Patterns
- All privileged functions use `require_auth()` to verify caller identity.
- Admin functions require both authentication and a stored admin check.
- Two-step ownership transfer (PendingAdmin pattern) prevents accidental lockout.
- Whitelist/blacklist checks run on every authenticated call.

### Integer Overflow/Underflow Protection
- Soroban SDK uses `i128` for amounts, avoiding common overflow issues.
- Arithmetic uses checked operations where available.
- Fee calculations bound by `MAX_FEE_BPS` and `MAX_FEE_BPS_CONFIG` constants.
- Total milestones and batch sizes are bounded by `MAX_MILESTONES` and `MAX_BATCH_SIZE`.

### Reentrancy Guard Patterns
- Token transfers happen after state updates (checks-effects-interactions).
- Job status transitions are strictly linear (Open -> InProgress -> SubmittedForReview -> Completed).
- Dispute resolution transfers only after status is verified and updated.

### Emergency Procedures
- `set_emergency_stop()` halts all non-admin operations immediately.
- Contract upgrades use a timelock (`UPGRADE_TIMELOCK_SECS = 86400`) to allow review.
- Fee configuration changes also require a timelock delay.
- Circuit breaker can pause rebalancing during extreme market volatility.

## Frontend Security

### XSS Prevention
- All user-generated content (job descriptions, proposals) is sanitized with DOMPurify.
- Strict nonce-based CSP headers without 'unsafe-inline' or 'unsafe-eval' (see [CSP Rollback Procedure](docs/csp-rollback-procedure.md)).
- React's built-in XSS protection via JSX escaping.
- Rich text editor (Tiptap) is configured to strip dangerous HTML.

### CSRF Protection
- API uses token-based authentication (Bearer tokens), not cookies.
- CORS is configured to only allow the deployment origin.
- Wallet signing requests require user interaction (no silent signing).

### Secure localStorage Usage
- Only non-sensitive data stored: wallet type preference, UI state.
- Secret keys are NEVER stored in localStorage.
- Public key is cached but re-verified on each session.
- Auto-reconnect preference is stored but never the wallet type's secret.

### Dependency Vulnerability Scanning
- Regular `npm audit` runs in CI.
- Dependabot configured for weekly npm and cargo updates.
- Docker images use minimal base images with regular updates.

## User Security

### Wallet Security Best Practices
1. Use a hardware wallet (Ledger) for high-value accounts.
2. Never share your secret key or mnemonic phrase.
3. Always verify the Stellar network passphrase before signing.
4. Review transaction details carefully before approving in wallet.
5. Keep your wallet extension updated to the latest version.

### Recognizing Phishing Attempts
- Always verify the URL is the official StellarWork domain.
- StellarWork will never ask for your secret key or mnemonic.
- Be suspicious of unsolicited messages asking you to approve transactions.
- Check that the contract ID in the transaction matches the official contract.

### Transaction Verification Before Signing
- Verify the destination address matches the expected recipient.
- Check the amount being transferred matches the job payment.
- Confirm the network passphrase matches the expected network.
- Review the operation type (payment, contract invocation, etc.).

## Incident Response

If you discover a vulnerability:

1. **Do not** open a public issue or share details publicly.
2. Email details to **bandanadivya.opensource@gmail.com**.
3. Include affected component, version/commit, impact severity, reproduction steps.
4. If available, include suggested remediation or mitigation guidance.

### Response Timeline
- Acknowledgment within **3 business days**.
- Severity assessment and next-step plan within **7 business days**.
- Coordinated disclosure after a fix is available.
