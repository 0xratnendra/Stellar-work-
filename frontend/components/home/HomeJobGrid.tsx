"use client";

import Link from "next/link";
import AvailabilityIndicator from "@/components/AvailabilityIndicator";
import ClientReputationBadge from "@/components/ClientReputationBadge";
import SwipeableJobCard from "@/components/SwipeableJobCard";
import TruncatedAddress from "@/components/TruncatedAddress";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import { formatDeadline, formatXlmWithFiat, type FiatCurrency, type XlmFiatRateCache } from "@/lib/format";
import type { Job } from "@/lib/types";

type HomeJob = { id: number; job: Job };
type JobsViewMode = "grid" | "list";

interface HomeJobGridProps {
  jobs: HomeJob[];
  page: number;
  pageSize: number;
  viewMode: JobsViewMode;
  wallet: string | null;
  bookmarkedIds: number[];
  animatingBookmarkId: number | null;
  actionLoading: number | null;
  cancelLoading: boolean;
  newJobIds: Set<number>;
  compareIds: number[];
  maxCompareJobs: number;
  fiatCurrency: FiatCurrency;
  fiatRates: XlmFiatRateCache | null;
  fiatTooltip: string;
  activeFreelancerJobCounts: ReadonlyMap<string, number>;
  getDescription: (hash: string) => string;
  onToggleCompare: (id: number) => void;
  onMarkViewed: (id: number) => void;
  onToggleBookmark: (id: number) => void;
  onAcceptJob: (id: number) => void;
  onCancelJob: (id: number) => void;
}

export default function HomeJobGrid({
  jobs,
  page,
  pageSize,
  viewMode,
  wallet,
  bookmarkedIds,
  animatingBookmarkId,
  actionLoading,
  cancelLoading,
  newJobIds,
  compareIds,
  maxCompareJobs,
  fiatCurrency,
  fiatRates,
  fiatTooltip,
  activeFreelancerJobCounts,
  getDescription,
  onToggleCompare,
  onMarkViewed,
  onToggleBookmark,
  onAcceptJob,
  onCancelJob,
}: HomeJobGridProps) {
  return (
    <ul
      className={viewMode === "grid" ? "grid list-none gap-4 md:grid-cols-2" : "flex list-none flex-col gap-4"}
      aria-label="Open jobs"
    >
      {jobs.slice((page - 1) * pageSize, page * pageSize).map(({ id, job }) => {
        const deadline = formatDeadline(job.deadline);
        const isOwnJob = wallet && job.client && wallet === job.client;

        return (
          <li key={id}>
            <SwipeableJobCard
              jobId={id}
              canAccept={job.status === "Open" && Boolean(wallet) && wallet !== job.client}
              canCancel={Boolean(wallet && wallet === job.client && job.status === "Open")}
              bookmarked={bookmarkedIds.includes(id)}
              disabled={actionLoading !== null || cancelLoading}
              onAccept={() => onAcceptJob(id)}
              onBookmark={() => onToggleBookmark(id)}
              onCancel={() => onCancelJob(id)}
            >
              <article
                className={`interactive-card h-full p-4 ${
                  viewMode === "list" ? "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" : ""
                }`}
              >
                <div className={viewMode === "list" ? "min-w-0 flex-1" : undefined}>
                  <div className="mb-1 flex items-start gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(id)}
                        onChange={() => onToggleCompare(id)}
                        disabled={!compareIds.includes(id) && compareIds.length >= maxCompareJobs}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                        aria-label={`Select Job #${id} for comparison`}
                      />
                      Compare
                    </label>
                    {isOwnJob && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                        Your Job
                      </span>
                    )}
                  </div>
                  <Link href={`/job/${id}`} className="block" onClick={() => onMarkViewed(id)}>
                    <h3 className="flex items-center gap-2 text-lg font-medium hover:underline">
                      Job #{id}
                      {newJobIds.has(id) && (
                        <span aria-hidden="true" className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          New
                        </span>
                      )}
                    </h3>
                  </Link>
                  {job.category && (() => {
                    const category = JOB_CATEGORIES.find(
                      (item) => item.id === job.category?.toLowerCase() || item.label === job.category,
                    );
                    const Icon = category?.icon;
                    return (
                      <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${category ? category.colorClass : "bg-slate-100 text-slate-600"}`}>
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        {category ? category.label : job.category}
                      </span>
                    );
                  })()}
                  <p className="mt-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold tabular-nums text-slate-700" title={fiatTooltip}>
                    {formatXlmWithFiat(job.amount, fiatCurrency, fiatRates?.rates)}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                    Token: {job.token ? <TruncatedAddress address={job.token} className="font-mono text-xs text-slate-400" /> : "N/A"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">{getDescription(job.description_hash)}</p>
                  <p className="mt-1 text-xs text-slate-500">Hash: {job.description_hash.slice(0, 12)}...</p>
                  {job.freelancer && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Freelancer:</span>
                      <TruncatedAddress address={job.freelancer} />
                      <AvailabilityIndicator
                        address={job.freelancer}
                        activeJobCount={activeFreelancerJobCounts.get(job.freelancer) ?? 0}
                      />
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-600">
                    {deadline ? `Deadline: ${deadline.isPast ? "Past due" : deadline.relative} • ${deadline.exact}` : "Deadline: No deadline"}
                  </p>
                  <div className="mt-2"><ClientReputationBadge clientAddress={job.client} /></div>
                </div>
                <div className={`flex flex-wrap items-center gap-2 ${viewMode === "list" ? "sm:shrink-0 sm:flex-col sm:items-stretch" : "mt-4"}`}>
                  <Link href={`/job/${id}`} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => onMarkViewed(id)}>
                    View Details
                  </Link>
                  {!isOwnJob ? (
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${!wallet || actionLoading === id ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"}`}
                      title={!wallet ? "Connect your wallet to accept jobs." : undefined}
                      onClick={() => onAcceptJob(id)}
                      disabled={!wallet || actionLoading !== null}
                      aria-busy={actionLoading === id}
                    >
                      {actionLoading === id ? "Processing..." : "Accept Job"}
                    </button>
                  ) : (
                    <span className="rounded-md px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed">Own Job</span>
                  )}
                  <button
                    type="button"
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${!wallet || actionLoading === id ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"}`}
                    title={!wallet ? "Connect your wallet to accept jobs." : undefined}
                    onClick={() => onAcceptJob(id)}
                    disabled={!wallet || actionLoading !== null}
                    aria-busy={actionLoading === id}
                  >
                    {actionLoading === id ? "Processing..." : "Accept Job"}
                  </button>
                  <button
                    type="button"
                    className={`rounded-md border px-4 py-2 text-sm font-medium transition-all duration-300 ${bookmarkedIds.includes(id) ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-300 text-slate-700 hover:bg-slate-50"} ${animatingBookmarkId === id ? "scale-110" : "scale-100"}`}
                    onClick={() => onToggleBookmark(id)}
                    aria-pressed={bookmarkedIds.includes(id)}
                  >
                    {bookmarkedIds.includes(id) ? "★ Saved" : "☆ Save"}
                  </button>
                </div>
                {!wallet && <p className="mt-2 text-xs text-amber-700">Connect your wallet to enable job actions.</p>}
              </article>
            </SwipeableJobCard>
          </li>
        );
      })}
    </ul>
  );
}
