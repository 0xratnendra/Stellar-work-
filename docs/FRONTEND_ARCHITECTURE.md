# Frontend Architecture

This document describes the StellarWork frontend architecture, component hierarchy, data flow, and integration patterns. For contract-to-frontend field mappings and data encodings, refer to the [Data Dictionary](file:///C:/Users/JUST%20J/repos/Stellar-work-/docs/DATA_DICTIONARY.md).

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI component library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| @stellar/stellar-sdk | 15.x | Stellar blockchain interaction |
| @stellar/freighter-api | 6.x | Freighter wallet integration |
| Vitest | 3.x | Unit testing |
| Playwright | 1.x | End-to-end testing |

## Directory Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page (open job listings)
│   ├── layout.tsx         # Root layout with providers
│   ├── navigation.tsx     # Navigation header with mobile menu
│   ├── globals.css        # Global styles and Tailwind config
│   ├── admin/page.tsx     # Admin panel (fee withdrawal, job overview)
│   ├── dashboard/page.tsx # User dashboard (posted/accepted jobs)
│   ├── disputes/page.tsx  # Dispute management
│   ├── post-job/page.tsx  # Job creation form
│   ├── job/[id]/page.tsx  # Job detail view with actions
│   └── profile/[address]/page.tsx  # Public user profile
├── components/            # Reusable UI components
├── lib/                   # Business logic and utilities
│   ├── config.ts         # Environment configuration validation
│   ├── contract.ts       # Smart contract interaction layer
│   ├── stellar.ts        # Stellar SDK wrapper and wallet connection
│   ├── types.ts          # Shared TypeScript types
│   ├── wallet-context.tsx # Wallet state provider
│   ├── notifications-context.tsx # Notification system
│   ├── ipfs-service.ts   # IPFS upload and fetch
│   ├── format.ts         # Value formatting utilities
│   ├── disputes-loader.ts # Dispute data aggregation
│   ├── modal.ts          # Modal focus trap utility
│   ├── recent-ids.ts     # Job ID caching for pagination
│   └── recent-searches.ts # Search history management
├── __tests__/            # Vitest unit tests
└── e2e/                  # Playwright E2E tests
```

## Component Hierarchy

```
RootLayout
├── WalletProvider (wallet state)
│   └── NotificationProvider (notification state)
│       └── ToastProvider (toast messages)
│           ├── Navigation
│           │   ├── NetworkBadge
│           │   ├── NotificationInbox
│           │   └── WalletButton
│           ├── CommandPalette (Cmd+K search)
│           ├── ScrollRestorer
│           └── Main Content (page-specific)
│               ├── HomePage
│               │   ├── JobCardSkeleton (loading)
│               │   ├── ErrorBanner
│               │   ├── EmptyState / NoResultsState
│               │   └── SectionCard (search, filters, job list)
│               ├── PostJobPage (form with validation)
│               ├── JobDetailPage
│               │   ├── StatusPill
│               │   ├── InfoTooltip
│               │   ├── CancelJobConfirmModal
│               │   └── Fixed action bar (mobile)
│               ├── DashboardPage
│               │   ├── SectionCard (stats, activity feed)
│               │   ├── JobSection (posted/accepted)
│               │   └── JobCard (with actions)
│               ├── DisputesPage
│               │   ├── DisputeCard
│               │   ├── RaiseDisputeModal
│               │   └── ResolveModal (admin)
│               ├── AdminPage
│               │   ├── SectionCard (fees, withdrawal history)
│               │   └── Job overview table
│               └── ProfilePage
└── Footer
```

## Data Flow

### Wallet Connection

1. `WalletProvider` initializes and checks Freighter for an existing session via `getPublicKey()`.
2. User clicks "Connect Wallet" which calls `connectWallet()` → Freighter `requestAccess()`.
3. Wallet address is stored in React context and available via `useWallet()` hook.
4. All contract write operations require a connected wallet.

### Contract Interaction

```
User Action → Page Component → lib/contract.ts → lib/stellar.ts → Soroban RPC → Smart Contract
```

1. **Page component** calls a function from `lib/contract.ts` (e.g., `postJob()`).
2. **contract.ts** builds the argument array using `nativeToScVal()` and calls `callContract()`.
3. **stellar.ts** handles the full transaction lifecycle:
   - Creates a `TransactionBuilder` with the contract call operation.
   - Simulates the transaction via Soroban RPC.
   - For read-only calls: returns the simulated result directly.
   - For write calls: assembles, signs (via Freighter), submits, and polls for confirmation.

### Read-Only vs Write Operations

| Type | Flow | Signing |
|------|------|---------|
| Read-only | `callContract(..., { readOnly: true })` → simulate → return `retval` | Not required |
| Write | `callContract(...)` → simulate → assemble → sign → submit → poll | Freighter signature required |

### IPFS Integration

Job descriptions are stored off-chain via IPFS:

1. **Upload**: `post-job` page hashes the description (SHA-256), uploads to IPFS via web3.storage (or localStorage fallback), then stores the CID on-chain via `store_description_cid`.
2. **Fetch**: Pages retrieve descriptions by checking localStorage first, then fetching the CID from the contract, then fetching from the IPFS gateway.

## Wallet Connection Pattern

The wallet connection uses the Freighter browser extension:

```typescript
import { useWallet } from "@/lib/wallet-context";

function MyComponent() {
  const { wallet, connectWallet, disconnectWallet } = useWallet();
  
  if (!wallet) {
    return <button onClick={connectWallet}>Connect Wallet</button>;
  }
  
  return <span>Connected: {wallet}</span>;
}
```

Key behaviors:
- `getPublicKey()` checks if Freighter is allowed and returns the address without prompting.
- `connectWallet()` triggers the Freighter access prompt.
- Concurrent connection attempts are deduplicated via a shared promise.

## Contract Interaction Layer

All contract calls go through `lib/contract.ts`, which provides typed wrappers:

```typescript
import { postJob, getJob, acceptJob } from "@/lib/contract";

const result = await postJob(wallet, amountStroops, descHash, payloadLen, deadline, tokenAddress);
const job = await getJob("1");
await acceptJob(wallet, "1");
```

Each function:
1. Calls `requireContractId()` to validate the contract ID is configured.
2. Converts arguments to Soroban `ScVal` format via `nativeToScVal()`.
3. Delegates to `callContract()` with the appropriate method name and arguments.

## Configuration

Environment variables are validated at runtime via `lib/config.ts`:

```typescript
import { validateConfig, getConfig } from "@/lib/config";

const result = validateConfig();
if (!result.valid) {
  console.error("Config errors:", result.errors);
}
```

See `docs/environments.md` for the full variable reference.

## Responsive Design

The frontend uses Tailwind CSS breakpoints:

| Breakpoint | Width | Target |
|-----------|-------|--------|
| Default | 0-639px | Mobile |
| `sm` | 640px+ | Large mobile / small tablet |
| `md` | 768px+ | Tablet |
| `lg` | 1024px+ | Desktop (navigation switches to inline) |

Key responsive patterns:
- **Navigation**: Hamburger menu below `lg`, inline links at `lg` and above.
- **Job cards**: Single column on mobile, grid layout on tablet+.
- **Action buttons**: Full-width on mobile (fixed bottom bar on job detail), inline on desktop.
- **Safe area**: `env(safe-area-inset-*)` padding for notched devices.

## Testing

| Type | Tool | Command | Scope |
|------|------|---------|-------|
| Unit | Vitest | `npm run test` | Individual functions and components |
| E2E | Playwright | `npm run test:e2e` | Full page flows |
| Lint | ESLint | `npm run lint` | Code quality |
| Type | TypeScript | `npm run typecheck` | Type safety |
