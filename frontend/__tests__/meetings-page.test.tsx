import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingsPage, {
  formatDateTime,
  ProposeMeetingModal,
} from "@/app/meetings/page";
import { MeetingsProvider, type Meeting } from "@/lib/meetings-context";

// Mock wallet context
vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => ({
    wallet: "GA2MOCKTESTERWALLET1234567890ABCDEF",
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
  }),
}));

describe("Meetings Page & Scheduling Flows", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("List View States", () => {
    it("renders empty state when there are no meetings", () => {
      render(
        <MeetingsProvider>
          <MeetingsPage />
        </MeetingsProvider>,
      );

      expect(screen.getByTestId("meetings-empty-state")).toBeInTheDocument();
      expect(screen.getByText("No meetings found.")).toBeInTheDocument();
    });

    it("renders loading state when isLoading prop is true", () => {
      render(
        <MeetingsProvider>
          <MeetingsPage isLoading={true} />
        </MeetingsProvider>,
      );

      expect(screen.getByTestId("meetings-loading")).toBeInTheDocument();
      expect(screen.getByLabelText("Loading meetings...")).toBeInTheDocument();
    });

    it("renders error alert when errorMessage is provided", () => {
      render(
        <MeetingsProvider>
          <MeetingsPage errorMessage="Failed to synchronize meetings from network" />
        </MeetingsProvider>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        "Failed to synchronize meetings from network",
      );
    });

    it("renders meeting cards and filters by status tabs", () => {
      const mockMeetings: Meeting[] = [
        {
          id: "m-confirmed",
          jobId: 10,
          title: "Architecture Review",
          proposedSlots: [],
          selectedSlot: {
            start: "2026-11-10T15:00:00Z",
            end: "2026-11-10T16:00:00Z",
          },
          status: "confirmed",
          proposer: "GA2MOCKTESTERWALLET1234567890ABCDEF",
          otherParty: "GBPEER99999999999999999999999999",
          createdAt: Date.now(),
          confirmedAt: Date.now(),
        },
        {
          id: "m-pending",
          jobId: 11,
          title: "Initial Sync",
          proposedSlots: [
            {
              start: "2026-11-12T10:00:00Z",
              end: "2026-11-12T10:30:00Z",
            },
          ],
          selectedSlot: null,
          status: "pending",
          proposer: "GBPEER99999999999999999999999999",
          otherParty: "GA2MOCKTESTERWALLET1234567890ABCDEF",
          createdAt: Date.now(),
          confirmedAt: null,
        },
      ];

      localStorage.setItem(
        "stellarwork:meetings",
        JSON.stringify(mockMeetings),
      );

      render(
        <MeetingsProvider>
          <MeetingsPage />
        </MeetingsProvider>,
      );

      expect(screen.getByText("Architecture Review")).toBeInTheDocument();
      expect(screen.getByText("Initial Sync")).toBeInTheDocument();

      // Click "Confirmed" filter tab
      const confirmedTab = screen.getByRole("button", { name: /^confirmed$/i });
      fireEvent.click(confirmedTab);

      expect(screen.getByText("Architecture Review")).toBeInTheDocument();
      expect(screen.queryByText("Initial Sync")).not.toBeInTheDocument();

      // Click "Pending" filter tab
      const pendingTab = screen.getByRole("button", { name: /^pending$/i });
      fireEvent.click(pendingTab);

      expect(screen.queryByText("Architecture Review")).not.toBeInTheDocument();
      expect(screen.getByText("Initial Sync")).toBeInTheDocument();
    });
  });

  describe("Timezone Rendering", () => {
    it("renders formatted date and time across different timezones", () => {
      const utcTimestamp = "2026-11-15T18:30:00.000Z";

      // Formatted in UTC
      const formattedUtc = formatDateTime(utcTimestamp, "UTC");
      expect(formattedUtc).toContain("6:30");
      expect(formattedUtc).toContain("Nov 15");

      // Formatted in Tokyo (UTC+9) -> next day 03:30
      const formattedTokyo = formatDateTime(utcTimestamp, "Asia/Tokyo");
      expect(formattedTokyo).toContain("Nov 16");
      expect(formattedTokyo).toContain("3:30");

      // Formatted in New York (UTC-5) -> 13:30
      const formattedNy = formatDateTime(utcTimestamp, "America/New_York");
      expect(formattedNy).toContain("Nov 15");
      expect(formattedNy).toContain("1:30");
    });
  });

  describe("Proposal Modal & Form Validation", () => {
    it("provides accessible time input controls and labels", () => {
      render(
        <ProposeMeetingModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Job ID")).toBeInTheDocument();
      expect(screen.getByLabelText("Meeting title")).toBeInTheDocument();
      expect(screen.getByLabelText("Participant address")).toBeInTheDocument();
      expect(screen.getByLabelText("Start time")).toBeInTheDocument();
      expect(screen.getByLabelText("End time")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Submit meeting proposal" }),
      ).toBeInTheDocument();
    });

    it("validates missing end times and past dates in the form", () => {
      const mockSubmit = vi.fn();
      render(
        <ProposeMeetingModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
        />,
      );

      // Fill in required fields with past start time
      fireEvent.change(screen.getByLabelText("Job ID"), {
        target: { value: "10" },
      });
      fireEvent.change(screen.getByLabelText("Meeting title"), {
        target: { value: "Past Interview" },
      });
      fireEvent.change(screen.getByLabelText("Participant address"), {
        target: { value: "GBPEER1234567" },
      });
      fireEvent.change(screen.getByLabelText("Start time"), {
        target: { value: "2020-01-01T10:00" },
      });
      fireEvent.change(screen.getByLabelText("End time"), {
        target: { value: "2020-01-01T11:00" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Submit meeting proposal" }),
      );

      expect(mockSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText("Meeting slot cannot be scheduled in the past"),
      ).toBeInTheDocument();
    });

    it("validates invalid date ranges (end time before start time)", () => {
      const mockSubmit = vi.fn();
      render(
        <ProposeMeetingModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
        />,
      );

      fireEvent.change(screen.getByLabelText("Job ID"), {
        target: { value: "20" },
      });
      fireEvent.change(screen.getByLabelText("Meeting title"), {
        target: { value: "Invalid Interval" },
      });
      fireEvent.change(screen.getByLabelText("Participant address"), {
        target: { value: "GBPEER1234567" },
      });
      fireEvent.change(screen.getByLabelText("Start time"), {
        target: { value: "2027-05-01T15:00" },
      });
      fireEvent.change(screen.getByLabelText("End time"), {
        target: { value: "2027-05-01T14:00" },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Submit meeting proposal" }),
      );

      expect(mockSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText("End time must be after start time"),
      ).toBeInTheDocument();
    });
  });
});
