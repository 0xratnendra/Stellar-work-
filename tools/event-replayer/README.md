# Event Replayer

A tool for fetching historical contract events from Stellar RPC and replaying them against a local Soroban test environment for integration testing.

## Features

- Fetch historical contract events from Stellar RPC `getEvents`
- Offline deterministic replay mode using committed JSON fixtures
- Parse and order events chronologically
- Replay events against a local Soroban test environment
- Verify final contract state matches expected values
- Loud failure when encountering unknown or malformed event types
- Configuration for event filters (by contract ID, event type, date range)
- Output summary report: events processed, state transitions, final balances
- Generate sample replay datasets from testnet activity

## Installation

```bash
cd tools/event-replayer
cargo build --release
```

## Usage

### Offline Replay Mode (CI & Local Testing)

Replay events from a fixture file offline without network RPC access:

```bash
cargo run --release -- --offline --input fixtures/valid-job-lifecycle.json --output replayed.json
```

Run the fixture test suite:

```bash
cargo test
```

### Refreshing Fixtures

When escrow contract event layouts or topic names are intentionally updated:
1. Capture new event traces from testnet:
   ```bash
   cargo run --release -- \
     --rpc-url https://soroban-testnet.stellar.org \
     --contract-id <CONTRACT_ID> \
     --output fixtures/valid-job-lifecycle.json
   ```
2. Verify the captured JSON schema against `ReplayDataset` in `src/lib.rs`.
3. Update unit and integration tests in `tests/replayer_tests.rs` to validate newly supported topics.
4. Commit updated fixture files to version control.

### Generate Sample Dataset

Generate a sample replay dataset from testnet activity:

```bash
cargo run --release -- --sample --output sample-dataset.json
```

### Fetch Events from RPC

Fetch events from a specific contract:

```bash
cargo run --release -- \
  --rpc-url https://soroban-testnet.stellar.org \
  --contract-id CC... \
  --output events.json
```

### Filter by Date Range

```bash
cargo run --release -- \
  --contract-id CC... \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-31T23:59:59Z" \
  --output events.json
```

### Filter by Event Type

```bash
cargo run --release -- \
  --contract-id CC... \
  --event-type job_approved \
  --output events.json
```

### Combined Filters

```bash
cargo run --release -- \
  --rpc-url https://soroban-testnet.stellar.org \
  --contract-id CC... \
  --start-time "2024-01-01T00:00:00Z" \
  --end-time "2024-01-31T23:59:59Z" \
  --event-type job_posted \
  --output filtered-events.json
```

## Output

The tool generates two files:

1. **Dataset file** (e.g., `events.json`): Contains the fetched events in JSON format
2. **Report file** (e.g., `events.report.json`): Contains the replay summary with state transitions and final balances

### Dataset Format

```json
{
  "contract_id": "CC...",
  "network": "testnet",
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-01-31T23:59:59Z",
  "events": [
    {
      "timestamp": "2024-01-01T12:00:00Z",
      "event_type": "job_posted",
      "contract_id": "CC...",
      "topic": ["job_posted"],
      "data": {"job_id": 1, "amount": 1000000}
    }
  ]
}
```

### Report Format

```json
{
  "dataset": {...},
  "events_processed": 4,
  "state_transitions": [
    "2024-01-01 12:00:00: job_posted",
    "2024-01-02 10:00:00: job_accepted"
  ],
  "final_balances": {
    "contract_balance": "25000",
    "platform_fees": "25000"
  },
  "summary": "Processed 4 events from 2024-01-01 to 2024-01-31"
}
```

## CI Integration

Offline fixture replay tests run in CI on every push and pull request touching `tools/event-replayer/**` or `contracts/escrow/**` via `.github/workflows/event-replayer.yml`.

## License

MIT
