use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub contract_id: String,
    pub topic: Vec<String>,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayDataset {
    pub contract_id: String,
    pub network: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub events: Vec<ReplayEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayReport {
    pub dataset: ReplayDataset,
    pub events_processed: usize,
    pub state_transitions: Vec<String>,
    pub final_balances: HashMap<String, String>,
    pub summary: String,
}

pub fn load_dataset_from_file<P: AsRef<Path>>(path: P) -> Result<ReplayDataset> {
    let data = fs::read_to_string(path).context("Failed to read dataset file")?;
    let dataset: ReplayDataset = serde_json::from_str(&data).context("Failed to parse dataset JSON")?;
    Ok(dataset)
}

pub fn replay_events(dataset: &ReplayDataset) -> Result<ReplayReport> {
    let mut state_transitions = Vec::new();
    let mut balances: HashMap<String, i128> = HashMap::new();

    for (index, event) in dataset.events.iter().enumerate() {
        if event.event_type.trim().is_empty() {
            bail!("Event at index {} has an empty event_type", index);
        }

        state_transitions.push(format!(
            "{}: {}",
            event.timestamp.format("%Y-%m-%d %H:%M:%S"),
            event.event_type
        ));

        match event.event_type.as_str() {
            "job_posted" | "job_created" => {
                let amount = event
                    .data
                    .get("amount")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(1000000);
                *balances.entry("contract_balance".to_string()).or_insert(0) += amount as i128;
            }
            "job_approved" => {
                let payout = event
                    .data
                    .get("payout")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(975000);
                let fee = event
                    .data
                    .get("fee")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(25000);
                *balances.entry("contract_balance".to_string()).or_insert(0) -= (payout + fee) as i128;
                *balances.entry("platform_fees".to_string()).or_insert(0) += fee as i128;
            }
            "fees_withdrawn" => {
                let withdrawn = event
                    .data
                    .get("amount")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                *balances.entry("platform_fees".to_string()).or_insert(0) -= withdrawn as i128;
            }
            "job_cancelled" => {
                let refund = event
                    .data
                    .get("refund")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                *balances.entry("contract_balance".to_string()).or_insert(0) -= refund as i128;
            }
            "dispute_resolved" => {
                let client_share = event
                    .data
                    .get("client_amount")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let freelancer_share = event
                    .data
                    .get("freelancer_amount")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                *balances.entry("contract_balance".to_string()).or_insert(0) -=
                    (client_share + freelancer_share) as i128;
            }
            "job_accepted"
            | "work_submitted"
            | "job_submitted"
            | "job_rejected"
            | "deadline_enforced"
            | "job_disputed"
            | "admin_transferred"
            | "fee_updated"
            | "max_active_jobs_updated" => {
                // Known lifecycle events with non-balance state transitions
            }
            unknown => {
                bail!(
                    "Unknown or malformed event type: '{}' at index {}",
                    unknown,
                    index
                );
            }
        }
    }

    let final_balances = balances
        .into_iter()
        .map(|(k, v)| (k, v.to_string()))
        .collect();

    let report = ReplayReport {
        dataset: dataset.clone(),
        events_processed: dataset.events.len(),
        state_transitions,
        final_balances,
        summary: format!(
            "Processed {} events from {} to {}",
            dataset.events.len(),
            dataset.start_time.format("%Y-%m-%d"),
            dataset.end_time.format("%Y-%m-%d")
        ),
    };

    Ok(report)
}
