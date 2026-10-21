use event_replayer::{load_dataset_from_file, replay_events};
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

#[test]
fn test_offline_replay_valid_job_lifecycle() {
    let fixture_path = fixtures_dir().join("valid-job-lifecycle.json");
    let dataset = load_dataset_from_file(&fixture_path).expect("Fixture should load");

    assert_eq!(dataset.events.len(), 4);
    assert_eq!(dataset.events[0].event_type, "job_created");
    assert_eq!(dataset.events[1].event_type, "job_accepted");
    assert_eq!(dataset.events[2].event_type, "job_submitted");
    assert_eq!(dataset.events[3].event_type, "job_approved");

    let report = replay_events(&dataset).expect("Replay should succeed");
    assert_eq!(report.events_processed, 4);
    assert_eq!(report.state_transitions.len(), 4);

    // Initial deposit: 2,500,000,000
    // Approved payout: 2,425,000,000, fee: 75,000,000
    // Resulting contract_balance: 0, platform_fees: 75,000,000
    assert_eq!(
        report.final_balances.get("contract_balance").map(|s| s.as_str()),
        Some("0")
    );
    assert_eq!(
        report.final_balances.get("platform_fees").map(|s| s.as_str()),
        Some("75000000")
    );
}

#[test]
fn test_offline_replay_dispute_resolution() {
    let fixture_path = fixtures_dir().join("disputed-job.json");
    let dataset = load_dataset_from_file(&fixture_path).expect("Fixture should load");

    assert_eq!(dataset.events.len(), 4);
    let report = replay_events(&dataset).expect("Replay should succeed");
    assert_eq!(report.events_processed, 4);

    // Initial deposit: 1,000,000,000
    // Split resolution: client 500,000,000 + freelancer 500,000,000 = 1,000,000,000 returned
    // Final contract balance: 0
    assert_eq!(
        report.final_balances.get("contract_balance").map(|s| s.as_str()),
        Some("0")
    );
}

#[test]
fn test_offline_replay_malformed_event_fails_loudly() {
    let fixture_path = fixtures_dir().join("malformed-event.json");
    let dataset = load_dataset_from_file(&fixture_path).expect("Fixture should load");

    let result = replay_events(&dataset);
    assert!(result.is_err(), "Unknown event type must fail loudly instead of being skipped");
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("Unknown or malformed event type"),
        "Error message should mention unknown or malformed event type, got: {}",
        err_msg
    );
    assert!(err_msg.contains("completely_unknown_event_type"));
}
