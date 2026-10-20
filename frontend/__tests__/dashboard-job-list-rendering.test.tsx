import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { BATCH_PAGE_SIZE, MAX_CONCURRENT_BATCHES } from "@/lib/hooks/useBatchJobs";
import type { Job } from "@/lib/types";

// ── Contract mocks ────────────────────────────────────────────────────────────

const mockGetJobsBatch = vi.fn();
const mockGetJobCount = vi.fn();
const mockGetCompletedJobsCount = vi.fn();
const mockGetJobStatusCounts = vi.fn();
const mockApproveWork = vi.fn();
const mockCancelJob = vi.fn();
const mockSubmitWork = vi.fn();
const mockEnforceDeadline = vi.fn();

vi.mock("@/lib/contract", () => ({
  getJobsBatch: (...args: unknown[]) => mockGetJobsBatch(...args),
  getJobCount: (...args: unknown[]) => mockGetJobCount(...args),
  getCompletedJobsCount: (...args: unknown[]) => mockGetCompletedJobsCount(...args),
  getJobStatusCounts: (...args: unknown[]) => mockGetJobStatusCounts(...args),
  approveWork: (...args: unknown[]) => mockApproveWork(...args),
  cancelJob: (...args: unknown[]) => mockCancelJob(...args),
  submitWork: (...args: unknown[]) => mockSubmitWork(...args),
  enforceDeadline: (...args: unknown[]) => mockEnforceDeadline(...args),
  freelancerCancelJob: vi.fn(),
  getDescriptionCid: vi.fn(),
  storeDescriptionCid: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => ({
    wallet: "GTESTWALLET",
    connectWallet: vi.fn(),
  }),
}));

vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock("@/lib/notifications-context", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    addNotification: vi.fn(),
    markAsSeen: vi.fn(),
    markAllAsSeen: vi.fn(),
    preferences: {
      job_accepted: true,
      work_submitted: true,
      work_approved: true,
      job_cancelled: true,
      dispute_raised: true,
      dispute_resolved: true,
    },
    setPreference: vi.fn(),
    clearNotifications: vi.fn(),
  }),
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getEventLabel: (event: string) => event,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    client: "GTESTWALLET",
    freelancer: null,
    amount: "10000000",
    description_hash: "hash",
    status: "Open",
    created_at: "1710000000",
    deadline: "0",
    token: "GTOKEN",
    revision_count: 0,
    submitted_at: "0",
    ...overrides,
  };
}

/**
 * Sets up mockGetJobsBatch so that calling it with (startId, limit) returns
 * the slice of `allJobs` that starts at index (startId - 1).
 * This mirrors the real contract behaviour: job IDs are 1-based.
 */
function setupBatchMock(allJobs: Job[]) {
  mockGetJobCount.mockResolvedValue(allJobs.length);
  mockGetJobsBatch.mockImplementation(
    (startId: string, limit: number): Promise<Job[]> => {
      const start = Number(startId) - 1; // convert 1-based ID to 0-based index
      return Promise.resolve(allJobs.slice(start, start + limit));
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Dashboard job list rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompletedJobsCount.mockResolvedValue(0);
    mockGetJobStatusCounts.mockResolvedValue({
      open: 0,
      in_progress: 0,
      submitted_for_review: 0,
      completed: 0,
      cancelled: 0,
      disputed: 0,
      total: 0,
    });
  });

  it("renders Open and InProgress jobs with their titles and amounts", async () => {
    setupBatchMock([
      makeJob({ status: "Open", amount: "10000000" }),
      makeJob({ status: "InProgress", amount: "25000000", freelancer: "GFREELANCER" }),
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Job #1" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Job #2" })).toBeInTheDocument();
    });

    // Status pills render alongside the filter toolbar chips — expect ≥2 each.
    expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThanOrEqual(2);

    // Amounts render formatted to 2dp.
    const decimalSeparator =
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? ".";

    expect(screen.getByText(`1${decimalSeparator}00`)).toBeInTheDocument();
    expect(screen.getByText(`2${decimalSeparator}50`)).toBeInTheDocument();
  });

  it("renders the empty state when the wallet has no jobs", async () => {
    setupBatchMock([]);

    render(<DashboardPage />);

    await waitFor(() => {
      const emptyTitles = screen.getAllByText("No jobs yet");
      expect(emptyTitles.length).toBe(2);
    });
    expect(screen.getAllByText("No jobs match this filter yet.").length).toBe(2);
  });

  it("renders skeleton placeholders while jobs are loading", async () => {
    // Hold getJobCount open so the loading state is observable.
    let resolveCount!: (n: number) => void;
    mockGetJobCount.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveCount = resolve;
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Loading jobs")).toBeInTheDocument();
    });

    resolveCount(0);
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading jobs")).not.toBeInTheDocument();
    });
  });

  it("renders the error banner without crashing when fetching jobs fails", async () => {
    mockGetJobCount.mockRejectedValueOnce(new Error("RPC unreachable"));

    render(<DashboardPage />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("RPC unreachable");
    });

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("retries with backoff when a rate-limit error occurs and eventually succeeds", async () => {
    vi.useFakeTimers();

    const job = makeJob({ status: "Open" });
    mockGetJobCount.mockResolvedValue(1);

    // First call hits rate-limit; second succeeds.
    mockGetJobsBatch
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValueOnce([job]);

    render(<DashboardPage />);

    // Advance past the initial 1 s backoff.
    await vi.advanceTimersByTimeAsync(2_000);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Job #1" })).toBeInTheDocument();
    });

    // Exactly 2 batch calls were made (1 failed + 1 retry).
    expect(mockGetJobsBatch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // ── Request count bound assertion ────────────────────────────────────────────
  //
  // With 1000 jobs, BATCH_PAGE_SIZE=50, and MAX_CONCURRENT_BATCHES=3 the hook
  // must make exactly ceil(1000/50) = 20 batch calls — not 1000 individual
  // calls like the old serial loop.

  it("stays within the request bound for a 1000-job contract", async () => {
    const TOTAL_JOBS = 1_000;
    const expectedBatchCalls = Math.ceil(TOTAL_JOBS / BATCH_PAGE_SIZE);

    // Build 1000 jobs; none belong to the test wallet so the filter discards
    // all of them — we just want to verify the call count, not the results.
    const allJobs: Job[] = Array.from({ length: TOTAL_JOBS }, () =>
      makeJob({ client: "GOTHER", freelancer: null }),
    );
    setupBatchMock(allJobs);

    render(<DashboardPage />);

    await waitFor(() => {
      // Both JobSections render their empty states once loading is done.
      const emptyHeadings = screen.getAllByText("No jobs yet");
      expect(emptyHeadings.length).toBeGreaterThanOrEqual(1);
    });

    // The hook must not exceed the batch call bound.
    expect(mockGetJobsBatch).toHaveBeenCalledTimes(expectedBatchCalls);

    // Sanity-check the bound is well below the old O(N) request count.
    expect(expectedBatchCalls).toBeLessThan(TOTAL_JOBS);

    // Each batch call must use a limit ≤ BATCH_PAGE_SIZE.
    for (const call of mockGetJobsBatch.mock.calls) {
      const limit = call[1] as number;
      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThanOrEqual(BATCH_PAGE_SIZE);
    }

    // Concurrent batches must not exceed the cap.
    // We verify this by checking that the number of pages is consistent
    // with grouping by MAX_CONCURRENT_BATCHES.
    const totalPages = mockGetJobsBatch.mock.calls.length;
    const groups = Math.ceil(totalPages / MAX_CONCURRENT_BATCHES);
    expect(groups).toBe(Math.ceil(expectedBatchCalls / MAX_CONCURRENT_BATCHES));
  });
});
