# Smart Contract to Frontend Data Dictionary

This document details the mapping between the Stellar Soroban `EscrowContract` data models and the StellarWork frontend TypeScript interfaces, formatting utilities, and data encodings.

---

## Field Mappings

### Job Struct (`EscrowContract::Job` -> `frontend/lib/types.ts::Job`)

| Contract Field | Contract Type | Frontend Property | Frontend Type | Optionality | Description & Formatting |
| -------------- | ------------- | ----------------- | ------------- | ----------- | ------------------------ |
| `client` | `Address` | `client` | `string` | Required | Stellar G-address of the job creator/client. Displayed truncated via `TruncatedAddress`. |
| `freelancer` | `Option<Address>` | `freelancer` | `string \| null` | Optional | Stellar G-address of the accepted freelancer. Null when status is `Open`. |
| `amount` | `i128` | `amount` | `string` | Required | Escrow amount in **stroops** (1 XLM = 10,000,000 stroops). Converted for UI using `toXlm(amount)`. |
| `description_hash` | `BytesN<32>` | `description_hash` | `string` | Required | Hex-encoded 64-character SHA-256 hash of the off-chain job description payload. |
| `status` | `JobStatus` | `status` | `JobStatus` | Required | Current lifecycle state enum value (e.g., `"Open"`, `"InProgress"`). |
| `created_at` | `u64` | `created_at` | `string` | Required | Ledger Unix timestamp in **seconds**. Formatted via `new Date(Number(created_at) * 1000).toLocaleString()`. |
| `deadline` | `u64` | `deadline` | `string` | Optional (`"0"`) | Unix timestamp in **seconds** for completion deadline. `0` indicates no deadline. |
| `token` | `Address` | `token` | `string` | Required | Stellar contract address for the token asset (native XLM or custom SAC token). |
| `revision_count` | `u32` | `revision_count` | `number` | Required | Number of revision requests issued by the client (capped at 3). |
| `submitted_at` | `u64` | `submitted_at` | `string` | Optional (`"0"`) | Ledger Unix timestamp when freelancer submitted work for review. |

---

## Unit Conversions & Encodings

### Amount Units
- **On-chain Unit**: Stroops ($1 \text{ XLM} = 10,000,000 \text{ stroops} = 10^7 \text{ stroops}$).
- **Frontend Storage**: Represented as `string` or `bigint` to prevent 64-bit precision loss when handling Soroban `i128`.
- **UI Display Helper**: `toXlm(stroops: string | number | bigint): string` (defined in `frontend/lib/format.ts`).

### Timestamp Units
- **On-chain Unit**: Seconds since Unix epoch ($t_{\text{ledger}}$).
- **Frontend Unit**: JavaScript `Date` expects milliseconds ($t_{\text{js}} = t_{\text{ledger}} \times 1000$).

### Enum Encodings (`JobStatus`)
| Contract Enum Variant | Value | Frontend String Literal | Description |
| --------------------- | ----- | ----------------------- | ----------- |
| `Open` | `0` | `"Open"` | Job posted, accepting freelancer claims. |
| `InProgress` | `1` | `"InProgress"` | Freelancer assigned, work in progress. |
| `SubmittedForReview` | `2` | `"SubmittedForReview"` | Work submitted, pending client review. |
| `Completed` | `3` | `"Completed"` | Work approved, funds released to freelancer. |
| `Cancelled` | `4` | `"Cancelled"` | Job cancelled, funds returned to client. |
| `Disputed` | `5` | `"Disputed"` | Dispute raised, awaiting administrative resolution. |

---

## List & Summary Response Fields

When querying batch list endpoints (e.g. `get_jobs_batch` or `get_job_status_counts`), summary objects omit heavy payload metadata:
- Full job description text is fetched lazily from IPFS/storage using `description_hash`.
- Summary responses omit individual milestone arrays (`Milestone[]`).

---

## Worked Example: Ledger Entry ScVal to UI Model

```typescript
import { scValToNative } from "@stellar/stellar-sdk";
import type { Job } from "@/lib/types";

// Raw Soroban ScVal map returned from `get_job(job_id)`
const rawScValJob = {
  client: "GXXXX...",
  freelancer: { vec: ["GYYYY..."] },
  amount: 100000000n, // 10 XLM in stroops
  description_hash: "a1b2c3...",
  status: { symbol: "InProgress" },
  created_at: 1710000000n,
  deadline: 1712592000n,
  token: "CAS3...",
  revision_count: 0,
  submitted_at: 0n,
};

// Frontend Transformation step
function decodeJobLedgerEntry(scVal: any): Job {
  const native = scValToNative(scVal);
  return {
    client: native.client,
    freelancer: native.freelancer ?? null,
    amount: native.amount.toString(),
    description_hash: native.description_hash.toString("hex"),
    status: native.status as JobStatus,
    created_at: native.created_at.toString(),
    deadline: native.deadline.toString(),
    token: native.token,
    revision_count: Number(native.revision_count),
    submitted_at: native.submitted_at.toString(),
  };
}

// UI Rendering
// toXlm(job.amount) -> "10.00 XLM"
// new Date(Number(job.created_at) * 1000).toLocaleDateString() -> "3/10/2024"
```

---

## Related Documentation
- [Contract Function Quick Reference](file:///C:/Users/JUST%20J/repos/Stellar-work-/docs/contract-reference.md)
- [Frontend Architecture](file:///C:/Users/JUST%20J/repos/Stellar-work-/docs/FRONTEND_ARCHITECTURE.md)
