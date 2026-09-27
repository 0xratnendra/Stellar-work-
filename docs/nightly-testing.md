# Nightly Test Suite & Fuzzing Guide

## Overview
This document describes the automated nightly test suite and contract fuzzing pipeline configured in `.github/workflows/nightly-fuzz-suite.yml`.

---

## Schedule & Scoping
- **Schedule**: Executes daily at 02:00 UTC via GitHub Actions cron.
- **Trigger**: Runs on the default branch (`main`) and can also be triggered manually via `workflow_dispatch`.
- **Target Coverage**:
  - Full Soroban smart contract unit and integration test suite (`cargo test --all-targets --all-features`).
  - Contract fuzzing and invariant targets (`cargo-fuzz`).
  - Full frontend component and helper test suites (`npm run test`).

---

## Local Reproduction of Nightly Failures

### 1. Contract Test Suite
To reproduce smart contract test runs locally:
```bash
cd contracts/escrow
cargo test --all-targets --all-features
```

### 2. Contract Fuzzing
To run the contract fuzzing target locally (requires `cargo-fuzz` and nightly Rust toolchain):
```bash
cargo install cargo-fuzz
cd contracts/escrow
cargo fuzz run fuzz_target_1 -- -max_total_time=300
```

### 3. Frontend Test Suite
To run the frontend unit test suite locally:
```bash
cd frontend
npm ci
npm run test
```

---

## Artifacts & Failure Handling
- **Artifacts**: Every nightly run uploads coverage and test target logs as workflow artifacts (`nightly-test-reports`).
- **Failure Alerts**: If a scheduled run fails, a GitHub Issue titled `🚨 Nightly Test Suite Failure: YYYY-MM-DD` is automatically opened and assigned the `CI/CD` label for triaging.
