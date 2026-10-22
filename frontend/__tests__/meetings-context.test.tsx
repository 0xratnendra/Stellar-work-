import React from "react";
import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MeetingsProvider,
  useMeetings,
  hasConflict,
  validateSlot,
  type Meeting,
  type TimeSlot,
} from "@/lib/meetings-context";

function MeetingsTestConsumer({
  onMount,
}: {
  onMount: (ctx: ReturnType<typeof useMeetings>) => void;
}) {
  const ctx = useMeetings();
  React.useEffect(() => {
    onMount(ctx);
  }, [ctx, onMount]);

  return (
    <div>
      <span data-testid="meetings-count">{ctx.meetings.length}</span>
      <div data-testid="meetings-list">
        {ctx.meetings.map((m) => (
          <div key={m.id} data-testid={`item-${m.id}`}>
            <span data-testid={`status-${m.id}`}>{m.status}</span>
            <span data-testid={`slot-${m.id}`}>
              {m.selectedSlot?.start ?? "none"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

describe("Meetings Context & Lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("handles full lifecycle: create, reschedule, cancel, and complete", () => {
    let contextValue!: ReturnType<typeof useMeetings>;

    render(
      <MeetingsProvider>
        <MeetingsTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MeetingsProvider>,
    );

    const slot1: TimeSlot = {
      start: "2026-11-01T10:00:00Z",
      end: "2026-11-01T11:00:00Z",
    };
    const slot2: TimeSlot = {
      start: "2026-11-01T14:00:00Z",
      end: "2026-11-01T15:00:00Z",
    };

    // 1. Create / Propose meeting
    act(() => {
      contextValue.proposeMeeting(
        42,
        "Technical Interview",
        [slot1],
        "GCLIENT111",
        "GFREELANCER222",
      );
    });

    expect(contextValue.meetings).toHaveLength(1);
    const meeting = contextValue.meetings[0];
    expect(meeting.title).toBe("Technical Interview");
    expect(meeting.status).toBe("pending");
    expect(meeting.selectedSlot).toBeNull();

    // 2. Reschedule proposal
    act(() => {
      contextValue.rescheduleProposal(meeting.id, [slot2]);
    });
    expect(contextValue.meetings[0].proposedSlots).toEqual([slot2]);

    // 3. Confirm slot
    act(() => {
      contextValue.confirmSlot(meeting.id, slot2);
    });
    expect(contextValue.meetings[0].status).toBe("confirmed");
    expect(contextValue.meetings[0].selectedSlot).toEqual(slot2);

    // 4. Complete meeting
    act(() => {
      contextValue.completeMeeting(meeting.id);
    });
    expect(contextValue.meetings[0].status).toBe("completed");

    // 5. Cancel meeting
    act(() => {
      contextValue.cancelMeeting(meeting.id);
    });
    expect(contextValue.meetings[0].status).toBe("cancelled");
  });

  it("rejects conflicting meeting slots", () => {
    let contextValue!: ReturnType<typeof useMeetings>;

    render(
      <MeetingsProvider>
        <MeetingsTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MeetingsProvider>,
    );

    const slotA: TimeSlot = {
      start: "2026-11-02T10:00:00Z",
      end: "2026-11-02T11:00:00Z",
    };
    const overlappingSlot: TimeSlot = {
      start: "2026-11-02T10:30:00Z",
      end: "2026-11-02T11:30:00Z",
    };

    act(() => {
      contextValue.proposeMeeting(1, "Meeting 1", [slotA], "GA", "GB");
    });
    const id1 = contextValue.meetings[0].id;

    act(() => {
      contextValue.confirmSlot(id1, slotA);
    });

    act(() => {
      contextValue.proposeMeeting(
        2,
        "Meeting 2",
        [overlappingSlot],
        "GA",
        "GC",
      );
    });
    const id2 = contextValue.meetings[1].id;

    // Conflict rejection assertion
    expect(() => {
      act(() => {
        contextValue.confirmSlot(id2, overlappingSlot);
      });
    }).toThrow("Time slot conflicts with an existing confirmed meeting");
  });

  it("persists to and restores from localStorage", () => {
    const existing: Meeting[] = [
      {
        id: "meeting-persisted",
        jobId: 99,
        title: "Persisted Kickoff",
        proposedSlots: [],
        selectedSlot: {
          start: "2026-12-01T09:00:00Z",
          end: "2026-12-01T10:00:00Z",
        },
        status: "confirmed",
        proposer: "GPROPOSER",
        otherParty: "GOTHER",
        createdAt: 1700000000000,
        confirmedAt: 1700000100000,
      },
    ];

    localStorage.setItem("stellarwork:meetings", JSON.stringify(existing));

    let contextValue!: ReturnType<typeof useMeetings>;
    render(
      <MeetingsProvider>
        <MeetingsTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MeetingsProvider>,
    );

    expect(contextValue.meetings).toHaveLength(1);
    expect(contextValue.meetings[0].id).toBe("meeting-persisted");
    expect(contextValue.meetings[0].title).toBe("Persisted Kickoff");
  });

  describe("Validation and Conflict Helpers", () => {
    it("validates past times, missing end times, and invalid ranges", () => {
      // Missing start or end
      expect(validateSlot({ start: "2026-11-01T10:00:00Z" }).valid).toBe(false);
      expect(validateSlot({ end: "2026-11-01T10:00:00Z" }).valid).toBe(false);

      // Invalid range: end before start
      const inverted = validateSlot({
        start: "2026-11-01T12:00:00Z",
        end: "2026-11-01T11:00:00Z",
      });
      expect(inverted.valid).toBe(false);
      expect(inverted.error).toBe("End time must be after start time");

      // Past time
      const past = validateSlot({
        start: "2020-01-01T10:00:00Z",
        end: "2020-01-01T11:00:00Z",
      });
      expect(past.valid).toBe(false);
      expect(past.error).toBe("Meeting slot cannot be scheduled in the past");

      // Valid future range
      const valid = validateSlot({
        start: "2027-01-01T10:00:00Z",
        end: "2027-01-01T11:00:00Z",
      });
      expect(valid.valid).toBe(true);
    });

    it("accurately detects overlapping meeting slots", () => {
      const confirmedMeeting: Meeting = {
        id: "m1",
        jobId: 1,
        title: "Team Standup",
        proposedSlots: [],
        selectedSlot: {
          start: "2026-11-01T14:00:00Z",
          end: "2026-11-01T15:00:00Z",
        },
        status: "confirmed",
        proposer: "GA",
        otherParty: "GB",
        createdAt: Date.now(),
        confirmedAt: Date.now(),
      };

      const overlap: TimeSlot = {
        start: "2026-11-01T14:30:00Z",
        end: "2026-11-01T15:30:00Z",
      };
      const noOverlap: TimeSlot = {
        start: "2026-11-01T15:30:00Z",
        end: "2026-11-01T16:30:00Z",
      };

      expect(hasConflict(overlap, [confirmedMeeting])).toBe(true);
      expect(hasConflict(noOverlap, [confirmedMeeting])).toBe(false);
    });
  });
});
