"use client";
import TruncatedAddress from "@/components/TruncatedAddress";
import Spinner from "@/components/Spinner";
import {
  useMeetings,
  validateSlot,
  type Meeting,
  type MeetingStatus,
  type TimeSlot,
} from "@/lib/meetings-context";
import { useWallet } from "@/lib/wallet-context";
import Link from "next/link";
import { useState, type FormEvent } from "react";

const STATUS_LABELS: Record<MeetingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_COLORS: Record<MeetingStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-slate-100 text-slate-600",
  completed: "bg-blue-100 text-blue-800",
};

export function formatDateTime(iso: string, timeZone?: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
  } catch {
    return iso;
  }
}

export function formatDuration(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function generateIcsContent(meeting: Meeting): string {
  const start =
    meeting.selectedSlot?.start ?? meeting.proposedSlots[0]?.start ?? "";
  const end = meeting.selectedSlot?.end ?? meeting.proposedSlots[0]?.end ?? "";
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtStart =
    new Date(start).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtEnd =
    new Date(end).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StellarWork//Meetings//EN",
    "BEGIN:VEVENT",
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${meeting.title}`,
    `UID:${meeting.id}@stellarwork.app`,
    `DTSTAMP:${now}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(meeting: Meeting) {
  const blob = new Blob([generateIcsContent(meeting)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meeting-${meeting.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProposeMeetingModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    jobId: number,
    title: string,
    slots: TimeSlot[],
    peer: string,
  ) => void;
}) {
  const [jobId, setJobId] = useState("");
  const [title, setTitle] = useState("");
  const [peer, setPeer] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const slot: TimeSlot = { start: startTime, end: endTime };
    const validation = validateSlot(slot);
    if (!validation.valid) {
      setValidationError(validation.error ?? "Invalid time slot");
      return;
    }

    const parsedJobId = parseInt(jobId, 10);
    if (isNaN(parsedJobId) || parsedJobId <= 0) {
      setValidationError("Valid Job ID is required");
      return;
    }

    if (!title.trim()) {
      setValidationError("Meeting title is required");
      return;
    }

    if (!peer.trim()) {
      setValidationError("Participant address is required");
      return;
    }

    onSubmit(parsedJobId, title.trim(), [slot], peer.trim());
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="schedule-modal-title"
          className="text-lg font-semibold text-slate-900"
        >
          Schedule Meeting
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {validationError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-2 text-xs text-red-600"
            >
              {validationError}
            </p>
          )}

          <div>
            <label
              htmlFor="meeting-job-id"
              className="block text-xs font-medium text-slate-700"
            >
              Job ID
            </label>
            <input
              id="meeting-job-id"
              aria-label="Job ID"
              type="number"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meeting-title"
              className="block text-xs font-medium text-slate-700"
            >
              Title
            </label>
            <input
              id="meeting-title"
              aria-label="Meeting title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="meeting-peer"
              className="block text-xs font-medium text-slate-700"
            >
              Participant Address
            </label>
            <input
              id="meeting-peer"
              aria-label="Participant address"
              type="text"
              value={peer}
              onChange={(e) => setPeer(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="meeting-start"
                className="block text-xs font-medium text-slate-700"
              >
                Start Time
              </label>
              <input
                id="meeting-start"
                aria-label="Start time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label
                htmlFor="meeting-end"
                className="block text-xs font-medium text-slate-700"
              >
                End Time
              </label>
              <input
                id="meeting-end"
                aria-label="End time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-label="Submit meeting proposal"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Propose Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MeetingsPage({
  isLoading = false,
  errorMessage = null,
}: {
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const {
    meetings,
    proposeMeeting,
    confirmSlot,
    cancelMeeting,
    completeMeeting,
    rescheduleProposal,
  } = useMeetings();
  const { wallet } = useWallet();
  const [filter, setFilter] = useState<MeetingStatus | "all">("all");
  const [actionMeetingId, setActionMeetingId] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredMeetings =
    filter === "all" ? meetings : meetings.filter((m) => m.status === filter);

  const handleConfirm = (meetingId: string, slot: TimeSlot) => {
    setActionError(null);
    try {
      confirmSlot(meetingId, slot);
      setActionMeetingId(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to confirm meeting slot",
      );
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsScheduleOpen(true)}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + New Meeting
          </button>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            {(
              ["all", "confirmed", "pending", "completed", "cancelled"] as const
            ).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f === "all" ? "All" : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(errorMessage || actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {errorMessage || actionError}
        </div>
      )}

      {isLoading ? (
        <div
          data-testid="meetings-loading"
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12"
        >
          <Spinner size={24} label="Loading meetings..." />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div
          data-testid="meetings-empty-state"
          className="rounded-lg border border-slate-200 bg-white p-8 text-center"
        >
          <p className="text-sm text-slate-500">No meetings found.</p>
          <p className="mt-1 text-xs text-slate-400">
            Propose a meeting from a job detail page or click New Meeting to get
            started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              wallet={wallet}
              onConfirm={(slot) => handleConfirm(meeting.id, slot)}
              onCancel={() => cancelMeeting(meeting.id)}
              onComplete={() => completeMeeting(meeting.id)}
              onReschedule={(slots) => rescheduleProposal(meeting.id, slots)}
              onDownloadIcs={() => downloadIcs(meeting)}
              actionMeetingId={actionMeetingId}
              setActionMeetingId={setActionMeetingId}
            />
          ))}
        </div>
      )}

      <ProposeMeetingModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onSubmit={(jobId, title, slots, peer) => {
          if (wallet) {
            proposeMeeting(jobId, title, slots, wallet, peer);
          }
        }}
      />
    </section>
  );
}

function MeetingCard({
  meeting,
  wallet,
  onConfirm,
  onCancel,
  onComplete,
  onReschedule,
  onDownloadIcs,
  actionMeetingId,
  setActionMeetingId,
}: {
  meeting: Meeting;
  wallet: string | null;
  onConfirm: (slot: { start: string; end: string }) => void;
  onCancel: () => void;
  onComplete: () => void;
  onReschedule: (slots: { start: string; end: string }[]) => void;
  onDownloadIcs: () => void;
  actionMeetingId: string | null;
  setActionMeetingId: (id: string | null) => void;
}) {
  const isOpen = actionMeetingId === meeting.id;
  const isParticipant =
    wallet && (wallet === meeting.proposer || wallet === meeting.otherParty);
  const canConfirm =
    isParticipant &&
    meeting.status === "pending" &&
    meeting.proposedSlots.length > 0;
  const canCancel =
    isParticipant &&
    meeting.status !== "cancelled" &&
    meeting.status !== "completed";
  const isPastConfirmed =
    meeting.status === "confirmed" &&
    meeting.selectedSlot &&
    new Date(meeting.selectedSlot.end) < new Date();

  return (
    <div
      data-testid={`meeting-card-${meeting.id}`}
      className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-slate-900">{meeting.title}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[meeting.status]}`}
            >
              {STATUS_LABELS[meeting.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Job{" "}
            <Link
              href={`/job/${meeting.jobId}`}
              className="text-blue-600 hover:underline"
            >
              #{meeting.jobId}
            </Link>{" "}
            ·{" "}
            {meeting.proposer === wallet ? (
              "You proposed"
            ) : (
              <>
                Proposed by <TruncatedAddress address={meeting.proposer} />
              </>
            )}
          </p>
          {meeting.selectedSlot && (
            <p
              className="mt-1 text-xs text-slate-700"
              data-testid="selected-slot-time"
            >
              {formatDateTime(meeting.selectedSlot.start)} (
              {formatDuration(
                meeting.selectedSlot.start,
                meeting.selectedSlot.end,
              )}
              )
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {meeting.status === "confirmed" && (
            <button
              type="button"
              onClick={onDownloadIcs}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              title="Export calendar file"
            >
              .ics
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Cancel
            </button>
          )}
          {isPastConfirmed && meeting.status === "confirmed" && (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-md border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Mark done
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={() => setActionMeetingId(isOpen ? null : meeting.id)}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              Pick slot
            </button>
          )}
        </div>
      </div>

      {isOpen && canConfirm && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-600">
            Select a time slot:
          </p>
          {meeting.proposedSlots.map((slot, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onConfirm(slot)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50"
            >
              {formatDateTime(slot.start)} (
              {formatDuration(slot.start, slot.end)})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActionMeetingId(null)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
