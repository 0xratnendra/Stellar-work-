use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use clap::Parser;
use event_replayer::{
    load_dataset_from_file, replay_events, ReplayDataset, ReplayEvent,
};
use soroban_rpc::{Client, EventsRequest};
use std::fs;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Soroban RPC endpoint URL
    #[arg(short, long, default_value = "https://soroban-testnet.stellar.org")]
    rpc_url: String,

    /// Contract ID to fetch events from
    #[arg(short, long)]
    contract_id: Option<String>,

    /// Start timestamp (ISO 8601 format)
    #[arg(short, long)]
    start_time: Option<String>,

    /// End timestamp (ISO 8601 format)
    #[arg(short, long)]
    end_time: Option<String>,

    /// Event type filter (e.g., "job_posted", "job_approved")
    #[arg(short, long)]
    event_type: Option<String>,

    /// Output file for replay data
    #[arg(short, long, default_value = "events.json")]
    output: PathBuf,

    /// Generate sample replay dataset from testnet
    #[arg(long)]
    sample: bool,

    /// Offline mode: replay events from a local file without RPC network access
    #[arg(long)]
    offline: bool,

    /// Input dataset JSON file for offline replay
    #[arg(short, long)]
    input: Option<PathBuf>,
}

async fn fetch_events(
    rpc_url: &str,
    contract_id: &str,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    event_type_filter: Option<&str>,
) -> Result<Vec<ReplayEvent>> {
    let client = Client::new(rpc_url);
    let mut events = Vec::new();

    let start_ledger = start_time.map(|_| 0u32);
    let end_ledger = end_time.map(|_| u32::MAX);

    let request = EventsRequest {
        start_ledger,
        end_ledger,
        filter: None,
    };

    let response = client
        .get_events(request)
        .await
        .context("Failed to fetch events from RPC")?;

    for event in response.events {
        if let Some(contract) = event.contract_id.as_ref() {
            if contract.to_string() != contract_id {
                continue;
            }
        }

        if let Some(filter) = event_type_filter {
            if !event.topics.iter().any(|t| t.to_string().contains(filter)) {
                continue;
            }
        }

        let replay_event = ReplayEvent {
            timestamp: Utc::now(),
            event_type: event
                .topics
                .first()
                .map(|t| t.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            contract_id: event
                .contract_id
                .map(|c| c.to_string())
                .unwrap_or_else(|| contract_id.to_string()),
            topic: event.topics.iter().map(|t| t.to_string()).collect(),
            data: serde_json::to_value(&event.value).unwrap_or(serde_json::Value::Null),
        };

        events.push(replay_event);
    }

    events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    Ok(events)
}

async fn generate_sample_dataset(output: PathBuf) -> Result<()> {
    let sample_dataset = ReplayDataset {
        contract_id: "SAMPLE_CONTRACT_ID".to_string(),
        network: "testnet".to_string(),
        start_time: Utc::now() - chrono::Duration::days(7),
        end_time: Utc::now(),
        events: vec![
            ReplayEvent {
                timestamp: Utc::now() - chrono::Duration::days(7),
                event_type: "job_posted".to_string(),
                contract_id: "SAMPLE_CONTRACT_ID".to_string(),
                topic: vec!["job_posted".to_string()],
                data: serde_json::json!({"job_id": 1, "amount": 1000000}),
            },
            ReplayEvent {
                timestamp: Utc::now() - chrono::Duration::days(6),
                event_type: "job_accepted".to_string(),
                contract_id: "SAMPLE_CONTRACT_ID".to_string(),
                topic: vec!["job_accepted".to_string()],
                data: serde_json::json!({"job_id": 1, "freelancer": "G..."}),
            },
            ReplayEvent {
                timestamp: Utc::now() - chrono::Duration::days(5),
                event_type: "work_submitted".to_string(),
                contract_id: "SAMPLE_CONTRACT_ID".to_string(),
                topic: vec!["work_submitted".to_string()],
                data: serde_json::json!({"job_id": 1}),
            },
            ReplayEvent {
                timestamp: Utc::now() - chrono::Duration::days(4),
                event_type: "job_approved".to_string(),
                contract_id: "SAMPLE_CONTRACT_ID".to_string(),
                topic: vec!["job_approved".to_string()],
                data: serde_json::json!({"job_id": 1, "payout": 975000, "fee": 25000}),
            },
        ],
    };

    let json = serde_json::to_string_pretty(&sample_dataset)?;
    fs::write(&output, json)?;
    println!("Sample dataset written to: {}", output.display());
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    if args.sample {
        generate_sample_dataset(args.output).await?;
        return Ok(());
    }

    let dataset = if args.offline || args.input.is_some() {
        let input_path = args
            .input
            .or_else(|| Some(args.output.clone()))
            .context("Please specify an input fixture dataset path via --input <PATH>")?;
        println!("Offline mode: Replaying dataset from {}", input_path.display());
        load_dataset_from_file(&input_path)?
    } else {
        let contract_id = args
            .contract_id
            .context("--contract-id is required when fetching events online from RPC")?;
        let start_time = args
            .start_time
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        let end_time = args
            .end_time
            .as_ref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        println!("Fetching events from contract: {}", contract_id);
        println!("RPC URL: {}", args.rpc_url);

        let events = fetch_events(
            &args.rpc_url,
            &contract_id,
            start_time,
            end_time,
            args.event_type.as_deref(),
        )
        .await?;

        if events.is_empty() {
            println!("No events found matching the criteria.");
            return Ok(());
        }

        let dataset = ReplayDataset {
            contract_id: contract_id.clone(),
            network: if args.rpc_url.contains("testnet") {
                "testnet".to_string()
            } else {
                "mainnet".to_string()
            },
            start_time: start_time.unwrap_or_else(|| events.first().unwrap().timestamp),
            end_time: end_time.unwrap_or_else(|| events.last().unwrap().timestamp),
            events,
        };

        let json = serde_json::to_string_pretty(&dataset)?;
        fs::write(&args.output, json)?;
        println!("Dataset written to: {}", args.output.display());
        dataset
    };

    println!("\nRunning event replay...");
    let report = replay_events(&dataset)?;

    println!("\n=== Replay Report ===");
    println!("{}", report.summary);
    println!("\nState Transitions:");
    for transition in &report.state_transitions {
        println!("  {}", transition);
    }
    println!("\nFinal Balances:");
    for (key, value) in &report.final_balances {
        println!("  {}: {}", key, value);
    }

    let report_path = args.output.with_extension("report.json");
    let report_json = serde_json::to_string_pretty(&report)?;
    fs::write(&report_path, report_json)?;
    println!("\nReport written to: {}", report_path.display());

    Ok(())
}
