# Frontend Feature Flags Layer

StellarWork includes a lightweight, client-side feature flag system implemented in [`frontend/lib/feature-flags.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/lib/feature-flags.ts). It allows incremental rollout of new features, safe testing in preview environments, runtime toggling in the Admin panel, and clean fallbacks.

---

## 1. Flag Definitions & Reference Table

All feature flags are defined statically in `FLAG_DEFINITIONS` within [`frontend/lib/feature-flags.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/lib/feature-flags.ts).

- **Local Storage Key**: `stellarwork:feature-flags`
- **URL Parameter Prefix**: `feature.<flagName>=true|false|1|0`
- **Environment Variable Prefix**: `NEXT_PUBLIC_FF_<FLAG_NAME_UPPERCASE>`

| Flag Name | Default Value | Description | Storage Key |
|-----------|---------------|-------------|-------------|
| `newDashboard` | `false` | New analytics dashboard layout | `stellarwork:feature-flags` |
| `newMessaging` | `false` | Redesigned messaging interface | `stellarwork:feature-flags` |
| `biddingSystem` | `false` | Freelancer bidding system for jobs | `stellarwork:feature-flags` |
| `milestones` | `false` | Milestone-based payment releases | `stellarwork:feature-flags` |
| `multiToken` | `false` | Support for multiple token types | `stellarwork:feature-flags` |

---

## 2. Precedence & Evaluation Hierarchy

When checking whether a feature flag is active via `isEnabled(flagName)`, the system checks sources in strict priority order (highest to lowest):

```
┌─────────────────────────────────────────────────────────┐
│ 1. URL Query Parameter (?feature.<name>=true|1|false|0) │  (Highest priority: manual testing & QA links)
└───────────────────────────┬─────────────────────────────┘
                            │ (if unset)
┌───────────────────────────▼─────────────────────────────┐
│ 2. Environment Variable (NEXT_PUBLIC_FF_<NAME>=true|1)  │  (Deployment-level defaults & staging config)
└───────────────────────────┬─────────────────────────────┘
                            │ (if unset)
┌───────────────────────────▼─────────────────────────────┐
│ 3. LocalStorage Overrides (stellarwork:feature-flags)   │  (Admin toggle / user preferences in browser)
└───────────────────────────┬─────────────────────────────┘
                            │ (if unset)
┌───────────────────────────▼─────────────────────────────┐
│ 4. Default Value (FLAG_DEFINITIONS[name].defaultValue)  │  (Lowest priority: codebase fallback)
└─────────────────────────────────────────────────────────┘
```

1. **URL Parameter Override**:
   - Format: `?feature.<flagName>=true` (or `=1`) to enable, `?feature.<flagName>=false` (or `=0`) to disable.
   - Parsed by `parseUrlOverrides(search)`.
   - Useful for testing flag combinations in staging/preview or sharing debug links with reviewers without altering browser storage.
2. **Environment Variable Override**:
   - Format: `NEXT_PUBLIC_FF_<FLAG_NAME_UPPERCASE>="true"` or `"1"`.
   - Read via `process.env`.
   - Useful for enabling flags globally in specific deployment environments (e.g., testnet vs. mainnet).
3. **LocalStorage User/Admin Overrides**:
   - Key: `stellarwork:feature-flags`.
   - Stored as a JSON object mapping flag names to booleans.
   - Modifiable directly by admins from `/admin`.
4. **Code Default**:
   - Configured statically in `FLAG_DEFINITIONS`. Default is `false` for unreleased features.

---

## 3. Flag Lifecycle & State Management

### Initialization
At app bootstrap or page mount (e.g., in `/admin` or client layout):
```ts
import { initFeatureFlags } from "@/lib/feature-flags";

initFeatureFlags();
```
`initFeatureFlags()` executes two tasks:
1. `loadOverrides()`: Reads `stellarwork:feature-flags` from `localStorage`, parses the JSON object, filters out any unknown or stale keys, and loads valid overrides into module memory.
2. `parseUrlOverrides()`: Parses `window.location.search` for any `feature.<flagName>` query parameters and stores them into URL override state.

### Reading Flag States
To check an individual flag in any component or utility:
```ts
import { isEnabled } from "@/lib/feature-flags";

if (isEnabled("newMessaging")) {
  // Render new messaging interface
} else {
  // Render legacy messaging interface
}
```
To obtain a snapshot of all flags and their resolved states:
```ts
import { getActiveFlags } from "@/lib/feature-flags";

const currentFlags = getActiveFlags();
// Returns { newDashboard: false, newMessaging: false, ... }
```

### Admin Toggle
Admins can inspect and toggle feature flags dynamically on the `/admin` page under the Feature Flags section:
- Calling `setFlagOverride(name, value)` updates the in-memory state and persists the new state to `localStorage`.
- Calling `clearFlagOverride(name)` removes the override for a specific flag, reverting to default or env values.
- Calling `clearAllOverrides()` purges the `stellarwork:feature-flags` key from `localStorage`.

### Stale Local Values & Cleanup
When a user sets a local override in their browser, that setting remains in `localStorage`. Over time, flags may be removed or refactored.
- **Filtering on Load**: `loadOverrides()` iterates through keys in `localStorage` and strictly checks `key in FLAG_DEFINITIONS`. Any unknown flag key is discarded from memory.
- **Sanitizing on Save**: When `saveOverrides()` is called, only keys existing in `FLAG_DEFINITIONS` are written back to storage.
- **Handling Deprecations**: If a feature flag is permanently graduated (always on) or decommissioned (removed), developers should remove it from `FLAG_DEFINITIONS`. When users visit the site, any previous local override for the retired key is ignored and not evaluated.

---

## 4. Failure Modes & Gotchas

### Stale Local Value Outliving a Feature
If a developer retires a feature flag and removes it from `FLAG_DEFINITIONS` while retaining code that still checks `isEnabled("retiredFlag")`:
- `isEnabled()` will immediately return `false` because unknown flag names fail the `name in FLAG_DEFINITIONS` check.
- **Best Practice**: Whenever retiring a flag, search the entire repository for string references to ensure no dead branch remains dependent on the flag. Remove the flag check and promote the target code path unconditionally.

### Server vs. Client Hydration
Feature flags that depend on `localStorage` or URL query parameters cannot be evaluated synchronously during server-side rendering (SSR), because `window` and `localStorage` are unavailable on the server.
- Default to safe fallback values on the server.
- Read overrides inside `useEffect` or client-side hooks to avoid hydration mismatch errors.

---

## 5. Step-by-Step: Adding a New Feature Flag

Follow these steps to introduce a new feature flag:

### Step 1: Register the Flag
Edit [`frontend/lib/feature-flags.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/lib/feature-flags.ts) and add the flag to `FLAG_DEFINITIONS`:

```ts
const FLAG_DEFINITIONS: Record<string, FlagDefinition> = {
  // ... existing flags
  aiAssistant: {
    defaultValue: false,
    description: "AI-powered job description assistant",
  },
};
```

### Step 2: (Optional) Expose Environment Variable
If you need the flag enabled during specific CI or preview builds, document the environment variable in [`.env.example`](file:///C:/Users/JUST%20J/repos/Stellar-work-/.env.example) and [`frontend/.env.example`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/.env.example):

```bash
# Feature Flag Overrides (optional)
NEXT_PUBLIC_FF_AIASSISTANT=false
```

### Step 3: Consume the Flag in Code
Import `isEnabled` and guard the feature:

```tsx
import { isEnabled } from "@/lib/feature-flags";

export function JobForm() {
  const showAiAssistant = isEnabled("aiAssistant");

  return (
    <div>
      {showAiAssistant && <AiAssistantWidget />}
      {/* ... rest of form */}
    </div>
  );
}
```

### Step 4: Add Unit Tests for Both Flag States
Add test cases in [`frontend/__tests__/feature-flags.test.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/__tests__/feature-flags.test.ts) (or your component test):

```ts
describe("aiAssistant feature flag", () => {
  it("defaults to false", () => {
    expect(isEnabled("aiAssistant")).toBe(false);
  });

  it("respects local override", () => {
    setFlagOverride("aiAssistant", true);
    expect(isEnabled("aiAssistant")).toBe(true);
    clearAllOverrides();
  });

  it("respects URL override", () => {
    parseUrlOverrides("?feature.aiAssistant=true");
    expect(isEnabled("aiAssistant")).toBe(true);
    parseUrlOverrides("?feature.aiAssistant=false");
    expect(isEnabled("aiAssistant")).toBe(false);
  });
});
```

---

## 6. Code Locations Consuming Feature Flags

- **Core Module**:
  - [`frontend/lib/feature-flags.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/lib/feature-flags.ts): Definitions, storage management, evaluation logic.
- **Admin Interface**:
  - [`frontend/app/admin/page.tsx`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/app/admin/page.tsx): Lists all active flags, permits toggling overrides in `localStorage`, and clearing overrides.
- **Test Suite**:
  - [`frontend/__tests__/feature-flags.test.ts`](file:///C:/Users/JUST%20J/repos/Stellar-work-/frontend/__tests__/feature-flags.test.ts): Unit tests covering defaults, overrides, precedence, and parsing.
- **Documentation**:
  - [`CONTRIBUTING.md`](file:///C:/Users/JUST%20J/repos/Stellar-work-/CONTRIBUTING.md): Feature flag developer guidelines.
  - [`docs/FRONTEND_ARCHITECTURE.md`](file:///C:/Users/JUST%20J/repos/Stellar-work-/docs/FRONTEND_ARCHITECTURE.md): Frontend architecture overview.
