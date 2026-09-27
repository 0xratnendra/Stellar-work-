"use client";

import { approveMilestone } from "@/lib/contract";
import { toXlm } from "@/lib/format";
import type { Milestone } from "@/lib/types";
import AriaLiveRegion from "@/components/AriaLiveRegion";

interface MilestoneProgressProps {
  jobId: string;
  milestones: Milestone[];
  /** Wallet address of the connected user. */
  wallet: string | null;
  /** Whether the job is currently InProgress (controls approval button). */
  isInProgress: boolean;
  /** Called after a successful milestone approval so the parent can refresh. */
  onMilestoneApproved: (milestoneId: number) => void;
  /** Called with error message if approval fails. */
  onError: (message: string) => void;
  /** True while any action is processing. */
  actionLoading: boolean;
  setActionLoading: (loading: boolean) => void;
}

export default function MilestoneProgress({
  jobId,
  milestones,
  wallet,
  isInProgress,
  onMilestoneApproved,
  onError,
  actionLoading,
  setActionLoading,
}: MilestoneProgressProps) {
  if (milestones.length === 0) return null;

  const released = milestones.filter((m) => m.is_released).length;
  const total = milestones.length;
  const pct = Math.round((released / total) * 100);

  const totalAmount = milestones.reduce(
    (acc, m) => acc + BigInt(m.amount),
    0n,
  );
  const releasedAmount = milestones
    .filter((m) => m.is_released)
    .reduce((acc, m) => acc + BigInt(m.amount), 0n);

  const progressValueText = `${released} of ${total} milestones released (${pct}%)`;
  const liveAnnouncement = released === total && total > 0 
    ? `All ${total} milestones have been completed and released.`
    : `${released} of ${total} milestones released.`;

  async function handleApprove(milestoneId: number) {
    if (!wallet) return;
    setActionLoading(true);
    try {
      await approveMilestone(wallet, jobId, milestoneId);
      onMilestoneApproved(milestoneId);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to approve milestone.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section aria-labelledby="milestone-heading" className="space-y-4">
      <AriaLiveRegion message={liveAnnouncement} politeness="polite" />
      <h2 id="milestone-heading" className="text-base font-semibold text-slate-900">
        Milestone Progress
      </h2>

      {/* Summary bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {released} of {total} milestone{total !== 1 ? "s" : ""} released
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={progressValueText}
          aria-label={`${pct}% of milestones released`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          {toXlm(releasedAmount)} / {toXlm(totalAmount)} XLM released
        </p>
      </div>

      {/* Milestone list */}
      <ol className="space-y-2" aria-label="Milestones">
        {milestones.map((m) => (
          <li
            key={m.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
              m.is_released
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* Status dot */}
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  m.is_released ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <div className="min-w-0">
                <p className="font-medium text-slate-800">
                  Milestone {m.id + 1}
                </p>
                <p className="tabular-nums text-xs text-slate-500">
                  {toXlm(m.amount)} XLM
                </p>
              </div>
            </div>

            {m.is_released ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Released
              </span>
            ) : isInProgress && wallet ? (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleApprove(m.id)}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Release payment for Milestone ${m.id + 1}`}
              >
                {actionLoading ? "…" : "Release"}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Pending
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
