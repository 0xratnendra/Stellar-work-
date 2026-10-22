"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type MeetingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Meeting {
  id: string;
  jobId: number;
  title: string;
  proposedSlots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  status: MeetingStatus;
  proposer: string;
  otherParty: string;
  createdAt: number;
  confirmedAt: number | null;
}

export function hasConflict(
  slot: TimeSlot,
  meetings: Meeting[],
  excludeMeetingId?: string,
): boolean {
  if (!slot?.start || !slot?.end) return false;
  const start = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();
  return meetings.some((m) => {
    if (
      m.id === excludeMeetingId ||
      m.status !== "confirmed" ||
      !m.selectedSlot
    ) {
      return false;
    }
    const mStart = new Date(m.selectedSlot.start).getTime();
    const mEnd = new Date(m.selectedSlot.end).getTime();
    return start < mEnd && end > mStart;
  });
}

export function validateSlot(slot: Partial<TimeSlot> | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!slot || !slot.start || !slot.end) {
    return { valid: false, error: "Both start time and end time are required" };
  }
  const start = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();
  if (isNaN(start) || isNaN(end)) {
    return { valid: false, error: "Invalid date format" };
  }
  if (end <= start) {
    return { valid: false, error: "End time must be after start time" };
  }
  if (start < Date.now()) {
    return {
      valid: false,
      error: "Meeting slot cannot be scheduled in the past",
    };
  }
  return { valid: true };
}

interface MeetingsContextValue {
  meetings: Meeting[];
  proposeMeeting: (
    jobId: number,
    title: string,
    slots: TimeSlot[],
    proposer: string,
    otherParty: string,
  ) => void;
  confirmSlot: (meetingId: string, slot: TimeSlot) => void;
  cancelMeeting: (meetingId: string) => void;
  completeMeeting: (meetingId: string) => void;
  rescheduleProposal: (meetingId: string, newSlots: TimeSlot[]) => void;
  getMeetingsForJob: (jobId: number) => Meeting[];
  getUpcomingMeetings: () => Meeting[];
  getPastMeetings: () => Meeting[];
}

const STORAGE_KEY = "stellarwork:meetings";

function loadMeetings(): Meeting[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveMeetings(meetings: Meeting[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  } catch {}
}

const MeetingsContext = createContext<MeetingsContextValue | null>(null);

export function MeetingsProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    setMeetings(loadMeetings());
  }, []);

  const persist = useCallback((updated: Meeting[]) => {
    setMeetings(updated);
    saveMeetings(updated);
  }, []);

  const proposeMeeting = useCallback(
    (
      jobId: number,
      title: string,
      slots: TimeSlot[],
      proposer: string,
      otherParty: string,
    ) => {
      const meeting: Meeting = {
        id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        jobId,
        title,
        proposedSlots: slots,
        selectedSlot: null,
        status: "pending",
        proposer,
        otherParty,
        createdAt: Date.now(),
        confirmedAt: null,
      };
      const updated = [...meetings, meeting];
      persist(updated);
    },
    [meetings, persist],
  );

  const confirmSlot = useCallback(
    (meetingId: string, slot: TimeSlot) => {
      if (hasConflict(slot, meetings, meetingId)) {
        throw new Error(
          "Time slot conflicts with an existing confirmed meeting",
        );
      }
      const updated = meetings.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              selectedSlot: slot,
              status: "confirmed" as MeetingStatus,
              confirmedAt: Date.now(),
            }
          : m,
      );
      persist(updated);
    },
    [meetings, persist],
  );

  const cancelMeeting = useCallback(
    (meetingId: string) => {
      const updated = meetings.map((m) =>
        m.id === meetingId ? { ...m, status: "cancelled" as MeetingStatus } : m,
      );
      persist(updated);
    },
    [meetings, persist],
  );

  const completeMeeting = useCallback(
    (meetingId: string) => {
      const updated = meetings.map((m) =>
        m.id === meetingId ? { ...m, status: "completed" as MeetingStatus } : m,
      );
      persist(updated);
    },
    [meetings, persist],
  );

  const rescheduleProposal = useCallback(
    (meetingId: string, newSlots: TimeSlot[]) => {
      const updated = meetings.map((m) =>
        m.id === meetingId
          ? {
              ...m,
              proposedSlots: newSlots,
              selectedSlot: null,
              status: "pending" as MeetingStatus,
            }
          : m,
      );
      persist(updated);
    },
    [meetings, persist],
  );

  const getMeetingsForJob = useCallback(
    (jobId: number) => meetings.filter((m) => m.jobId === jobId),
    [meetings],
  );

  const getUpcomingMeetings = useCallback(
    () =>
      meetings
        .filter((m) => m.status === "confirmed" || m.status === "pending")
        .sort((a, b) =>
          String(a.selectedSlot?.start ?? a.createdAt).localeCompare(
            String(b.selectedSlot?.start ?? b.createdAt),
          ),
        ),
    [meetings],
  );

  const getPastMeetings = useCallback(
    () =>
      meetings
        .filter((m) => m.status === "completed" || m.status === "cancelled")
        .sort((a, b) => b.createdAt - a.createdAt),
    [meetings],
  );

  return (
    <MeetingsContext.Provider
      value={{
        meetings,
        proposeMeeting,
        confirmSlot,
        cancelMeeting,
        completeMeeting,
        rescheduleProposal,
        getMeetingsForJob,
        getUpcomingMeetings,
        getPastMeetings,
      }}
    >
      {children}
    </MeetingsContext.Provider>
  );
}

const defaultMeetingsContext: MeetingsContextValue = {
  meetings: [],
  proposeMeeting: async () => {},
  cancelMeeting: async () => {},
  confirmSlot: async () => {},
  completeMeeting: async () => {},
  rescheduleProposal: async () => {},
  getMeetingsForJob: () => [],
  getUpcomingMeetings: () => [],
  getPastMeetings: () => [],
};

export function useMeetings() {
  const ctx = useContext(MeetingsContext);
  return ctx ?? defaultMeetingsContext;
}
