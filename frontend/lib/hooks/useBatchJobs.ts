"use client";

import { useCallback, useRef, useState } from "react";
import { getJobsBatch, getJobCount } from "@/lib/contract";
import type { Job } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Maximum number of jobs the contract returns per `get_jobs_batch` call.
 * The contract caps batches at this size (error #33 BatchTooLarge above it).
 * Keeping it at 50 leaves headroom below the cap and avoids large simulations.
 */
export const BATCH_PAGE_SIZE = 50;

/**
 * Maximum number of batch requests in flight at the same time.
 * At BATCH_PAGE_SIZE=50 and MAX_CONCURRENT=3, a 1000-job contract is covered
 * in ceil(1000/50)/3 = 7 round-trips of wall-clock time (≤20 RPC calls total).
 */
export const MAX_CONCURRENT_BATCHES = 3;

/**
 * Initial backoff delay (ms) on a rate-limit response.
 * Doubles on each consecutive rate-limit until MAX_BACKOFF_MS.
 */
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 16_000;

// ── Rate-limit detection ───────────────────────────────────────────────────────

/**
 * Returns true when the error message looks like an RPC rate-limit response.
 * Covers Soroban RPC HTTP 429 and the circuit-breaker / retry-exhaustion
 * messages produced by lib/contract-retry.ts.
 */
export function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("circuit breaker") ||
    lower.includes("circuit_open") ||
    /failed after \d+ attempts/.test(lower)
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BatchJobsProgress {
  /** Jobs fetched so far (may still be loading). */
  loaded: number;
  /** Total job count from the contract. null until the first getJobCount call resolves. */
  total: number | null;
}

export interface UseBatchJobsResult {
  /**
   * Fetches every job on the contract in batches and filters by the
   * provided predicate.  Resolves when all batches complete.
   * Rejects on non-rate-limit errors; automatically retries with backoff
   * on rate-limit errors, falling back to a smaller window automatically.
   */
  fetchAllMatching: (
    predicate: (job: Job) => boolean,
    options?: { signal?: AbortSignal },
  ) => Promise<Array<{ id: number; job: Job }>>;

  /** Live progress — update the UI incrementally on slow connections. */
  progress: BatchJobsProgress;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * useBatchJobs
 *
 * Replaces the serial `for (let id = 1; id <= count; id++)` pattern in the
 * dashboard with bounded batch reads.
 *
 * Algorithm:
 *   1. Fetch the total job count (1 RPC call).
 *   2. Divide the [1, count] ID range into pages of BATCH_PAGE_SIZE.
 *   3. Run up to MAX_CONCURRENT_BATCHES pages in parallel.
 *   4. On a rate-limit error, pause the affected batch slot, wait with
 *      exponential backoff, then retry with a halved page size.
 *   5. Emit incremental progress so the caller can update the UI.
 *
 * Request count bound:
 *   ceil(count / BATCH_PAGE_SIZE) + 1 (for getJobCount)
 *   e.g. 1000 jobs → ceil(1000/50)+1 = 21 total RPC calls
 *        vs the old loop: 1001 RPC calls
 */
export function useBatchJobs(): UseBatchJobsResult {
  const [progress, setProgress] = useState<BatchJobsProgress>({
    loaded: 0,
    total: null,
  });

  // Guard against state updates after unmount / after a new fetch has started.
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAllMatching = useCallback(
    async (
      predicate: (job: Job) => boolean,
      options?: { signal?: AbortSignal },
    ): Promise<Array<{ id: number; job: Job }>> => {
      // Cancel any in-flight fetch from a previous call.
      abortControllerRef.current?.abort();
      const ownController = new AbortController();
      abortControllerRef.current = ownController;

      // Merge with an optional caller-supplied signal.
      const signal = options?.signal
        ? AbortSignal.any([ownController.signal, options.signal])
        : ownController.signal;

      setProgress({ loaded: 0, total: null });

      // ── Step 1: get total job count ─────────────────────────────────────
      const total = await getJobCount();
      if (signal.aborted) return [];

      setProgress({ loaded: 0, total });

      if (total === 0) return [];

      // ── Step 2: build page descriptors ─────────────────────────────────
      // Pages are identified by their start ID (1-based, inclusive).
      // getJobsBatch(start, limit) returns jobs[start .. start+limit-1].
      const pages: Array<{ startId: number; limit: number }> = [];
      for (let startId = 1; startId <= total; startId += BATCH_PAGE_SIZE) {
        const limit = Math.min(BATCH_PAGE_SIZE, total - startId + 1);
        pages.push({ startId, limit });
      }

      const result: Array<{ id: number; job: Job }> = [];
      let loadedCount = 0;
      let backoffMs = INITIAL_BACKOFF_MS;

      // ── Step 3: run pages with concurrency cap ──────────────────────────
      // Process pages in groups of MAX_CONCURRENT_BATCHES.
      for (
        let groupStart = 0;
        groupStart < pages.length;
        groupStart += MAX_CONCURRENT_BATCHES
      ) {
        if (signal.aborted) break;

        const group = pages.slice(groupStart, groupStart + MAX_CONCURRENT_BATCHES);

        // Run this group in parallel.
        const groupResults = await Promise.all(
          group.map(async ({ startId, limit }) => {
            let effectiveLimit = limit;
            let attempt = 0;
            const localBackoff = backoffMs;

            while (true) {
              if (signal.aborted) return [];
              try {
                const batch = await getJobsBatch(String(startId), effectiveLimit);
                // Reset global backoff on success.
                backoffMs = INITIAL_BACKOFF_MS;
                return batch
                  .map((job, i) => ({ id: startId + i, job }))
                  .filter(({ job }) => predicate(job));
              } catch (err) {
                if (signal.aborted) return [];

                if (isRateLimitError(err)) {
                  attempt += 1;
                  const delay = Math.min(
                    localBackoff * Math.pow(2, attempt - 1),
                    MAX_BACKOFF_MS,
                  );
                  // Back off and halve the page size to reduce pressure.
                  effectiveLimit = Math.max(1, Math.floor(effectiveLimit / 2));
                  await new Promise<void>((resolve) =>
                    setTimeout(resolve, delay),
                  );
                  continue; // retry
                }

                // Non-rate-limit error: propagate to caller.
                throw err;
              }
            }
          }),
        );

        // Merge this group's results and update progress.
        for (const matches of groupResults) {
          result.push(...matches);
        }
        const batchedJobCount = group.reduce((sum, p) => sum + p.limit, 0);
        loadedCount = Math.min(loadedCount + batchedJobCount, total);
        setProgress({ loaded: loadedCount, total });
      }

      return result;
    },
    [],
  );

  return { fetchAllMatching, progress };
}
