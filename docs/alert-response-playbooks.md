# Alert Response Playbooks

This document provides operational triage, diagnostic commands, mitigation steps, and escalation paths for every alert rule configured in [`monitoring/prometheus/alerts.yml`](file:///C:/Users/JUST%20J/repos/Stellar-work-/monitoring/prometheus/alerts.yml).

Responders should follow these playbooks during an incident to minimize mean-time-to-detection (MTTD) and mean-time-to-resolution (MTTR).

---

## Alert Index

| Alert Name | Severity | Owning Team | Primary Dashboard Panel | Playbook Link | Last Review Date |
|------------|----------|-------------|-------------------------|---------------|------------------|
| `FrontendTargetDown` | `critical` | Platform | [Frontend targets up](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=1) | [#frontendtargetdown](#frontendtargetdown) | 2026-10-21 |
| `SyntheticProbeFailing` | `critical` | Platform | [Frontend targets up](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=1) | [#syntheticprobefailing](#syntheticprobefailing) | 2026-10-21 |
| `ContractTxFailureRateHigh` | `critical` | Platform | [Contract tx success rate (1h)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=2) | [#contracttxfailureratehigh](#contracttxfailureratehigh) | 2026-10-21 |
| `ContractTxLatencyHigh` | `warning` | Platform | [Contract transaction latency](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=6) | [#contracttxlatencyhigh](#contracttxlatencyhigh) | 2026-10-21 |
| `RpcErrorSpike` | `warning` | Platform | [Stellar RPC errors by kind](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=9) | [#rpcerrorspike](#rpcerrorspike) | 2026-10-21 |
| `LcpRegression` | `warning` | Frontend | [p75 LCP](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=3) | [#lcpregression](#lcpregression) | 2026-10-21 |
| `InpRegression` | `warning` | Frontend | [p75 INP](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=4) | [#inpregression](#inpregression) | 2026-10-21 |
| `ClientErrorSpike` | `warning` | Frontend | [Unhandled frontend errors by kind](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=10) | [#clienterrorspike](#clienterrorspike) | 2026-10-21 |
| `HttpErrorRateHigh` | `warning` | Platform | [HTTP error rate (1h)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=14) | [#httperrorratehigh](#httperrorratehigh) | 2026-10-21 |
| `HttpLatencyHigh` | `warning` | Platform | [HTTP request latency (p95)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=13) | [#httplatencyhigh](#httplatencyhigh) | 2026-10-21 |

---

## Playbooks

### FrontendTargetDown

- **Severity**: `critical`
- **Team**: Platform (`#stellarwork-incidents`)
- **PromQL Expression**: `up{job="stellarwork-frontend"} == 0` for 5m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
Prometheus cannot scrape the `/api/metrics` endpoint of one or more frontend instances for over 5 minutes. The frontend container may have crashed, entered an Out-Of-Memory (OOM) loop, or the internal HTTP server is unresponsive.

#### 2. Likely Causes
- Next.js application process crashed (OOM killed, unhandled process rejection, node crash).
- Container networking failure or DNS resolution issue between Prometheus and frontend pods.
- Deployment failure / bad roll-out causing container crash back-off (`CrashLoopBackOff`).
- Accidental firewall, ingress routing rule, or reverse proxy modification.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [Frontend targets up](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=1)
- **Prometheus Target Status**: `http://localhost:9090/targets#job-stellarwork-frontend`
- **Direct Probe**:
  ```bash
  curl -Iv http://localhost:3000/api/metrics
  ```
- **Container / Pod Logs**:
  ```bash
  docker compose logs --tail=100 frontend
  # or in Kubernetes:
  kubectl logs -l app=stellarwork-frontend --tail=100 -n production
  ```
- **Check Process / Container State**:
  ```bash
  docker compose ps frontend
  # or in Kubernetes:
  kubectl describe pod -l app=stellarwork-frontend -n production | grep -E "State:|Reason:|Exit Code:"
  ```

#### 4. Immediate Mitigation
1. **Restart Frontend Instances**: If hung or unresponsive:
   ```bash
   docker compose restart frontend
   # or Kubernetes rollout restart:
   kubectl rollout restart deployment/stellarwork-frontend -n production
   ```
2. **Rollback Recent Deployment**: If the crash started immediately following a new release:
   ```bash
   kubectl rollout undo deployment/stellarwork-frontend -n production
   ```
3. **Verify Health**: Confirm `/api/metrics` returns HTTP 200 and Prometheus shows target `UP` (1).

#### 5. Escalation & Related Runbook
- **Escalation**: Page Platform On-Call in Slack `#stellarwork-incidents` if not resolved within 10 minutes.
- **Related Runbook**: [OPS_RUNBOOK.md - Section 3: Incident Response](./OPS_RUNBOOK.md#3-incident-response).

---

### SyntheticProbeFailing

- **Severity**: `critical`
- **Team**: Platform (`#stellarwork-incidents`)
- **PromQL Expression**: `probe_success{job="blackbox-http"} == 0` for 5m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The Prometheus Blackbox synthetic probe is failing external HTTP reachability checks against user-facing URLs (e.g. `/`, `/post-job`, `/dashboard`) for 5 minutes. Real users cannot access the platform.

#### 2. Likely Causes
- Ingress gateway, CDN (Cloudflare/CloudFront), or edge load balancer outage.
- SSL/TLS certificate expiry or misconfiguration.
- DNS resolution failure or domain registrar issue.
- Root route returning HTTP 5xx errors or connection timeouts.

#### 3. First Links & Diagnostic Commands
- **External curl check**:
  ```bash
  curl -Iv -L https://stellarwork.app
  ```
- **Check TLS Certificate**:
  ```bash
  echo | openssl s_client -servername stellarwork.app -connect stellarwork.app:443 2>/dev/null | openssl x509 -noout -dates
  ```
- **Blackbox Exporter Logs**:
  ```bash
  docker compose logs --tail=50 blackbox-exporter
  ```

#### 4. Immediate Mitigation
1. Check edge status: verify whether CDN/Cloudflare is reporting errors or edge blocks.
2. Ingress restart / reload: restart the ingress controller if proxy connections are dropped.
3. Post incident banner: if external outage persists, publish an outage notice using [maintenance-window-announcement-template.md](./maintenance-window-announcement-template.md).

#### 5. Escalation & Related Runbook
- **Escalation**: PagerDuty SEV-1 incident. Alert `#stellarwork-incidents` immediately.
- **Related Runbook**: [production-escalation.md](./production-escalation.md) and [OPS_RUNBOOK.md](./OPS_RUNBOOK.md).

---

### ContractTxFailureRateHigh

- **Severity**: `critical`
- **Team**: Platform (`#stellarwork-incidents`)
- **PromQL Expression**: `(sum(rate(stellarwork_contract_tx_total{outcome="error"}[10m])) / clamp_min(sum(rate(stellarwork_contract_tx_total[10m])), 0.001)) > 0.1` for 10m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
More than 10% of smart contract invocations (`stellarwork_contract_tx_total{outcome="error"}`) have failed over the past 10 minutes. Freelancer job submissions, approvals, or payments are failing on-chain.

#### 2. Likely Causes
- Soroban RPC provider node desync, fee surge, or rate limit throttling.
- Smart contract logic failure (e.g. invalid state, escrow deadline passed, expired contract TTL).
- Token contract authorization failure or insufficient client balance for escrow deposits.
- Escrow contract upgrade failure or ABI mismatch with frontend artifacts.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [Contract transactions by outcome](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=5)
- **Check Stellar RPC Health**:
  ```bash
  curl -s https://soroban-rpc.stellar.org \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger","params":{}}' | jq '.result'
  ```
- **Simulate Failed Contract Call**: Check recent error logs in Sentry or frontend server for contract error codes (e.g., `Error(Contract, #1)`). Refer to [contract-error-messages.md](./contract-error-messages.md).
- **Inspect Contract State**:
  ```bash
  soroban contract invoke --id $NEXT_PUBLIC_CONTRACT_ID --network mainnet -- get_job_count
  ```

#### 4. Immediate Mitigation
1. **RPC Failover**: If the primary RPC is throttling or desynced, update `NEXT_PUBLIC_SOROBAN_RPC` to an alternate RPC provider endpoint and redeploy or restart the gateway.
2. **Contract TTL Restoration**: If contract or instance storage has expired, run `soroban contract restore` or extend instance TTL as documented in [contract-upgrade-runbook.md](./contract-upgrade-runbook.md).
3. **Emergency Pause / Banner**: If an on-chain bug or critical vulnerability is identified, toggle emergency announcement banner in Admin panel or follow [emergency contract procedures in OPS_RUNBOOK.md](./OPS_RUNBOOK.md#4-emergency-contract-upgrade).

#### 5. Escalation & Related Runbook
- **Escalation**: Notify Smart Contract Lead and Platform On-Call in `#stellarwork-incidents`.
- **Related Runbook**: [contract-error-messages.md](./contract-error-messages.md), [OPS_RUNBOOK.md](./OPS_RUNBOOK.md).

---

### ContractTxLatencyHigh

- **Severity**: `warning`
- **Team**: Platform (`#stellarwork-alerts`)
- **PromQL Expression**: `histogram_quantile(0.95, sum by (le) (rate(stellarwork_contract_tx_duration_milliseconds_bucket[10m]))) > 20000` for 15m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The 95th percentile (p95) duration of Soroban contract invocations exceeds 20 seconds for over 15 minutes. Users experience long loading spinners when accepting jobs, depositing funds, or releasing milestones.

#### 2. Likely Causes
- Stellar network congestion leading to delayed transaction inclusion in ledgers.
- Underprovisioned or overloaded Soroban RPC endpoint taking too long to simulate transactions or poll for ledger close.
- Network latency between client/server and the RPC provider.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [Contract transaction latency](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=6)
- **Check Stellar Ledger Close Times**:
  ```bash
  curl -s https://horizon.stellar.org/fee_stats | jq '.ledger_capacity_usage'
  ```
- **Measure RPC Latency Directly**:
  ```bash
  curl -w "@scripts/curl-format.txt" -o /dev/null -s -X POST https://soroban-rpc.stellar.org \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork","params":{}}'
  ```

#### 4. Immediate Mitigation
1. Check fee surge pricing: if transaction queueing is delayed by network surge pricing, increase base fee configuration or fee multiplier in wallet adapter settings.
2. Switch RPC endpoint to an alternative provider or private RPC cluster.
3. Inform users via UI status banner if Stellar network-wide congestion is occurring.

#### 5. Escalation & Related Runbook
- **Escalation**: Notify `#stellarwork-alerts`. If latency exceeds 45s or failure rate rises, escalate to SEV-2.
- **Related Runbook**: [PERFORMANCE.md](./PERFORMANCE.md).

---

### RpcErrorSpike

- **Severity**: `warning`
- **Team**: Platform (`#stellarwork-alerts`)
- **PromQL Expression**: `sum(rate(stellarwork_rpc_errors_total[5m])) > 0.5` for 10m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The rate of Stellar RPC communication errors exceeds 0.5 errors per second across a 5-minute rolling window.

#### 2. Likely Causes
- RPC HTTP 429 Too Many Requests (rate limiting by the provider).
- HTTP 502/503/504 Bad Gateway / Gateway Timeout from the RPC node.
- Ledger sync delay (`Transaction status unknown`, transaction submission timeout).

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [Stellar RPC errors by kind](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=9)
- **PromQL Breakdown by Kind**:
  ```promql
  sum by (kind) (rate(stellarwork_rpc_errors_total[10m]))
  ```
- **Check RPC status and rate limits**: Inspect response headers (`X-RateLimit-Remaining`, `Retry-After`) from the RPC endpoint.

#### 4. Immediate Mitigation
1. If rate limited, rotate the Soroban RPC API key or switch to secondary endpoint in `NEXT_PUBLIC_SOROBAN_RPC`.
2. Tune frontend client retry and backoff parameters: adjust `NEXT_PUBLIC_CONTRACT_RETRY_MAX` if retries are compounding load.

#### 5. Escalation & Related Runbook
- **Escalation**: Post in `#stellarwork-alerts`. Escalate to Platform Lead if RPC provider fails to recover within 30 minutes.
- **Related Runbook**: [OPS_RUNBOOK.md - Section 1: Monitoring](./OPS_RUNBOOK.md#soroban-rpc-health).

---

### LcpRegression

- **Severity**: `warning`
- **Team**: Frontend (`#stellarwork-alerts`)
- **PromQL Expression**: `histogram_quantile(0.75, sum by (le) (rate(stellarwork_web_vital_milliseconds_bucket{metric="lcp"}[30m]))) > 2500` for 30m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The 75th percentile of Largest Contentful Paint (LCP) reported by real users exceeds 2.5 seconds (the Core Web Vitals threshold for "Good" performance).

#### 2. Likely Causes
- Recent frontend deployment introduced large unoptimized images, hero banners, or heavy font files.
- Client bundle bloat or main thread blocking scripts delaying initial paint.
- Slow server response time (TTFB) on SSR routes or IPFS gateway latency for job banners.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [p75 LCP](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=3) and [Core Web Vitals (p75)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=7)
- **Run Bundle Analysis**:
  ```bash
  cd frontend && npm run check-bundle-size
  ```
- **Measure Font & Asset Performance**:
  ```bash
  cd frontend && npm run measure-font-perf
  ```
- **Check TTFB Breakdown**:
  ```promql
  histogram_quantile(0.75, sum by (le, path) (rate(stellarwork_web_vital_milliseconds_bucket{metric="ttfb"}[30m])))
  ```

#### 4. Immediate Mitigation
1. Identify the offending route from Prometheus labels (`path="/job/[id]"` vs `path="/"`).
2. If regression occurred directly following a release, compare git commits for newly added asset imports or un-chunked dependencies.
3. Revert offending commit or apply image optimization / lazy loading (`next/image`, `priority={false}`).

#### 5. Escalation & Related Runbook
- **Escalation**: Assign issue to Frontend On-Call engineer in `#stellarwork-alerts`.
- **Related Runbook**: [PERFORMANCE.md](./PERFORMANCE.md).

---

### InpRegression

- **Severity**: `warning`
- **Team**: Frontend (`#stellarwork-alerts`)
- **PromQL Expression**: `histogram_quantile(0.75, sum by (le) (rate(stellarwork_web_vital_milliseconds_bucket{metric="inp"}[30m]))) > 200` for 30m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The 75th percentile of Interaction to Next Paint (INP) exceeds 200 milliseconds, indicating UI unresponsiveness, lagging inputs, or sluggish button response.

#### 2. Likely Causes
- Heavy computations executing synchronously on the React main thread during user clicks or keystrokes.
- Expensive re-renders caused by unmemoized wallet state or large job lists without virtualization.
- Synchronous cryptographic hashing, key parsing, or heavy regex filtering during form input.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [p75 INP](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=4)
- **Identify Affected Routes**:
  ```promql
  histogram_quantile(0.75, sum by (le, path) (rate(stellarwork_web_vital_milliseconds_bucket{metric="inp"}[30m])))
  ```
- **Local Profile**: Run Chrome DevTools Performance Profiler on the identified route with 4x CPU throttling.

#### 4. Immediate Mitigation
1. Wrap expensive state updates in `startTransition` or debounce rapid input handlers.
2. Ensure large listings (e.g. jobs, disputes, transaction history) utilize pagination or virtualized lists (`react-window`).
3. Defer non-critical analytics or background tasks off the main thread.

#### 5. Escalation & Related Runbook
- **Escalation**: Assign to Frontend performance lead.
- **Related Runbook**: [PERFORMANCE.md](./PERFORMANCE.md).

---

### ClientErrorSpike

- **Severity**: `warning`
- **Team**: Frontend (`#stellarwork-alerts`)
- **PromQL Expression**: `sum(rate(stellarwork_client_errors_total[5m])) > 1` for 10m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
Real users are encountering more than 1 unhandled frontend runtime exception per second over a 10-minute period.

#### 2. Likely Causes
- JavaScript exception in client components (e.g., `TypeError: Cannot read properties of undefined`).
- Wallet connection edge case (e.g., unsupported wallet extension version, malformed account object).
- API contract change returning unexpected JSON schema that breaks frontend deserialization.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [Unhandled frontend errors by kind](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=10)
- **Check Sentry Issues**: Open Sentry dashboard for project `stellarwork-frontend` and sort by "Newest / Impacted Users".
- **PromQL Error Distribution by Path**:
  ```promql
  sum by (kind, path) (rate(stellarwork_client_errors_total[10m]))
  ```

#### 4. Immediate Mitigation
1. If tied to a specific broken feature or page, toggle the corresponding feature flag off in the Admin panel (see [FEATURE_FLAGS.md](./FEATURE_FLAGS.md)).
2. If caused by a newly deployed frontend version, initiate an immediate rollback:
   ```bash
   kubectl rollout undo deployment/stellarwork-frontend -n production
   ```
3. Deploy a hotfix with defensive optional chaining (`?.`) or safe fallback in error boundaries.

#### 5. Escalation & Related Runbook
- **Escalation**: Frontend On-Call in `#stellarwork-alerts`. If errors affect >10% of sessions, escalate to SEV-2.
- **Related Runbook**: [ERROR_HANDLING.md](./ERROR_HANDLING.md).

---

### HttpErrorRateHigh

- **Severity**: `warning`
- **Team**: Platform (`#stellarwork-alerts`)
- **PromQL Expression**: `(sum(rate(stellarwork_http_errors_total[10m])) / clamp_min(sum(rate(stellarwork_http_requests_total[10m])), 0.001)) > 0.01` for 10m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
More than 1% of server-side HTTP requests returned HTTP 4xx or 5xx status codes over a 10-minute window.

#### 2. Likely Causes
- API routes (`/api/*`) throwing unhandled server exceptions (HTTP 500).
- Upstream IPFS gateway or RPC timeouts causing internal server error returns.
- Authentication/authorization failures or malformed payload submissions triggering 400/403 bursts.
- Malicious scanning or bot probing hitting non-existent endpoints.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [HTTP error rate (1h)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=14) and [HTTP requests by route](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=12)
- **Query Error Rate by Route**:
  ```promql
  sum by (route) (rate(stellarwork_http_errors_total[10m]))
  ```
- **Inspect Server Logs**:
  ```bash
  docker compose logs --tail=200 frontend | grep -E "status=[45][0-9][0-9]|ERROR"
  ```

#### 4. Immediate Mitigation
1. Pinpoint whether errors are 4xx (client-side/bot) or 5xx (server failure).
2. If 5xx from `/api/metrics`, verify in-memory metric store memory bounds and Prometheus scrape headers.
3. If 5xx from IPFS or external services, check third-party status and enable cached fallbacks.

#### 5. Escalation & Related Runbook
- **Escalation**: Platform On-Call in `#stellarwork-alerts`.
- **Related Runbook**: [OPS_RUNBOOK.md](./OPS_RUNBOOK.md).

---

### HttpLatencyHigh

- **Severity**: `warning`
- **Team**: Platform (`#stellarwork-alerts`)
- **PromQL Expression**: `histogram_quantile(0.95, sum by (le) (rate(stellarwork_http_request_duration_milliseconds_bucket[10m]))) > 3000` for 15m
- **Last Reviewed**: 2026-10-21

#### 1. What it means
The 95th percentile (p95) server-side HTTP request processing time exceeds 3 seconds for over 15 minutes.

#### 2. Likely Causes
- Slow external upstream calls inside Next.js API routes (e.g. blocking Soroban RPC queries or slow IPFS downloads).
- High CPU or memory utilization causing NodeJS event loop starvation.
- Database/caching contention or resource starvation on the hosting cluster.

#### 3. First Links & Diagnostic Commands
- **Grafana Panel**: [HTTP request latency (p95)](http://localhost:3001/d/stellarwork-overview/stellarwork-platform-overview?viewPanel=13)
- **Top Slowest Routes**:
  ```promql
  topk(5, histogram_quantile(0.95, sum by (le, route) (rate(stellarwork_http_request_duration_milliseconds_bucket[10m]))))
  ```
- **Check Node.js CPU & Memory Usage**:
  ```bash
  docker stats --no-stream frontend
  ```

#### 4. Immediate Mitigation
1. Identify if a specific route is dominating latency; add caching headers (`Cache-Control: s-maxage=60`) to read-heavy endpoints.
2. Scale out frontend replicas to distribute concurrency load:
   ```bash
   kubectl scale deployment/stellarwork-frontend --replicas=5 -n production
   ```
3. Set aggressive timeouts on upstream server-to-server fetches to prevent cascading delays.

#### 5. Escalation & Related Runbook
- **Escalation**: Platform On-Call in `#stellarwork-alerts`.
- **Related Runbook**: [PERFORMANCE.md](./PERFORMANCE.md).
