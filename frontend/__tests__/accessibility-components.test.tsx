import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NotificationInbox from "../components/NotificationInbox";
import RichTextEditor from "../components/RichTextEditor";
import SwipeableJobCard from "../components/SwipeableJobCard";
import * as notifContext from "../lib/notifications-context";
import * as walletContext from "../lib/wallet-context";
import * as messagingContext from "../lib/messaging-context";
import * as messagingLib from "../lib/messaging";
import MessagesPage from "../app/messages/page";

// ── Mock contexts ─────────────────────────────────────────────────────────────

const mockNotifications = [
  {
    id: "notif-1",
    jobId: 101,
    event: "job_accepted" as const,
    message: "New job created for Frontend Dev",
    seen: false,
    timestamp: 1710000000000,
  },
  {
    id: "notif-2",
    jobId: 102,
    event: "work_submitted" as const,
    message: "Work submitted for Smart Contract",
    seen: true,
    timestamp: 1710000100000,
  },
];

const mockMarkAsSeen = vi.fn();
const mockMarkAllAsSeen = vi.fn();
const mockClearNotifications = vi.fn();
const mockSetPreference = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(notifContext, "useNotifications").mockReturnValue({
    notifications: mockNotifications,
    unreadCount: 1,
    markAsSeen: mockMarkAsSeen,
    markAllAsSeen: mockMarkAllAsSeen,
    clearNotifications: mockClearNotifications,
    preferences: {
      job_accepted: true,
      work_submitted: true,
      work_approved: true,
      job_cancelled: true,
      dispute_raised: true,
      dispute_resolved: true,
    },
    setPreference: mockSetPreference,
    refreshNotifications: vi.fn(),
  });
});

describe("NotificationInbox Accessibility [A11Y-49]", () => {
  it("renders with accessible button label indicating unread count", () => {
    render(<NotificationInbox />);
    const button = screen.getByRole("button", { name: /Notifications, 1 unread/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens modal dialog with list semantics and accessible unread indicators", () => {
    render(<NotificationInbox />);
    const trigger = screen.getByRole("button", { name: /Notifications/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Notification inbox" });
    expect(dialog).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Notifications list" });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);

    // Unread item exposed via aria-current and accessible label
    const unreadLink = screen.getByRole("link", { name: /Unread notification: Job Accepted/i });
    expect(unreadLink).toBeInTheDocument();
    expect(unreadLink).toHaveAttribute("aria-current", "true");

    // Action button to mark as read has clear accessible name
    const markReadBtn = screen.getByRole("button", { name: /Mark as read: Job Accepted/i });
    expect(markReadBtn).toBeInTheDocument();
    fireEvent.click(markReadBtn);
    expect(mockMarkAsSeen).toHaveBeenCalledWith("notif-1");
  });

  it("supports Up and Down arrow keys for list navigation", () => {
    render(<NotificationInbox />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));

    const list = screen.getByRole("list", { name: "Notifications list" });
    const links = screen.getAllByRole("link");

    // Arrow down moves focus to first then second item
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[0]);

    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[1]);

    // Arrow up moves back
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[0]);
  });
});

describe("MessagesPage Conversation List Accessibility [A11Y-49]", () => {
  beforeEach(() => {
    vi.spyOn(walletContext, "useWallet").mockReturnValue({
      wallet: "GCLIENT123",
      walletNetwork: "testnet",
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
      switchAccount: vi.fn(),
      clearCachedData: vi.fn(),
      refreshWalletNetwork: vi.fn(),
      isSwitching: false,
      isConnecting: false,
      isFreighterInstalled: true,
      kit: null,
      balance: "100",
      isLoadingBalance: false,
    });
    vi.spyOn(messagingContext, "useMessaging").mockReturnValue({
      unreadCount: 2,
      refreshUnread: vi.fn(),
    });
    vi.spyOn(messagingLib, "loadConversations").mockReturnValue([
      {
        peerAddress: "GFREELANCER456789012345678901234567890123456789",
        unreadCount: 2,
        lastMessageAt: 1710000000000,
        lastMessageSnippet: "Looking forward to starting!",
        lastMessageFrom: "GFREELANCER456789012345678901234567890123456789",
      },
    ]);
  });

  it("renders conversation list with list semantics and accessible unread count", () => {
    render(<MessagesPage />);
    const list = screen.getByRole("list", { name: "Conversations" });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(1);

    const link = screen.getByRole("link", { name: /Conversation with GFREEL.*6789.*2 unread/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("aria-current", "true");

    const optionsBtn = screen.getByRole("button", { name: /Conversation options for GFREEL.*6789/i });
    expect(optionsBtn).toBeInTheDocument();
  });
});

describe("RichTextEditor Accessibility [A11Y-48]", () => {
  it("renders toolbar with roving tabindex and accessible toggle states", () => {
    render(
      <RichTextEditor
        value="<p>Test content</p>"
        onChange={vi.fn()}
      />
    );

    const toolbar = screen.getByRole("toolbar", { name: /Text formatting toolbar/i });
    expect(toolbar).toBeInTheDocument();

    const boldBtn = screen.getByRole("button", { name: /Bold/i });
    expect(boldBtn).toBeInTheDocument();
    expect(boldBtn).toHaveAttribute("aria-pressed");

    const headingBtn = screen.getByRole("button", { name: /Heading level 2/i });
    expect(headingBtn).toBeInTheDocument();
    expect(headingBtn).toHaveAttribute("aria-pressed");

    // Only first button has tabIndex 0 initially
    expect(headingBtn).toHaveAttribute("tabindex", "0");
    expect(boldBtn).toHaveAttribute("tabindex", "-1");

    // Arrow navigation moves roving tabindex
    fireEvent.keyDown(headingBtn, { key: "ArrowRight" });
    expect(boldBtn).toHaveAttribute("tabindex", "0");
    expect(headingBtn).toHaveAttribute("tabindex", "-1");
  });

  it("associates instructions and labels with the editing surface", () => {
    render(
      <div>
        <label id="test-label">Job Details</label>
        <RichTextEditor
          value="<p>Test</p>"
          onChange={vi.fn()}
          labelId="test-label"
        />
      </div>
    );

    const editorSurface = screen.getByRole("textbox");
    expect(editorSurface).toHaveAttribute("aria-multiline", "true");
    expect(editorSurface).toHaveAttribute("aria-labelledby", "test-label");
    expect(editorSurface.getAttribute("aria-describedby")).toContain("rich-text-editor-instructions");
  });

  it("opens accessible link dialog with modal focus trap", () => {
    render(
      <RichTextEditor
        value="<p>Test</p>"
        onChange={vi.fn()}
      />
    );

    const linkBtn = screen.getByRole("button", { name: /Insert or edit link/i });
    fireEvent.click(linkBtn);

    const dialog = screen.getByRole("dialog", { name: "Insert or edit link" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/Link URL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });
});

describe("SwipeableJobCard Accessibility [A11Y-47]", () => {
  const props = {
    jobId: 42,
    canAccept: true,
    canCancel: true,
    bookmarked: false,
    onAccept: vi.fn(),
    onBookmark: vi.fn(),
    onCancel: vi.fn(),
    enabled: true,
  };

  it("exposes reachable, labelled buttons for keyboard users", () => {
    render(
      <SwipeableJobCard {...props}>
        <div>Job content</div>
      </SwipeableJobCard>
    );

    const keyboardAccept = screen.getByTestId("keyboard-accept-42");
    expect(keyboardAccept).toHaveAttribute("aria-label", "Accept job #42");

    const keyboardBookmark = screen.getByTestId("keyboard-bookmark-42");
    expect(keyboardBookmark).toHaveAttribute("aria-label", "Bookmark job #42");

    const keyboardCancel = screen.getByTestId("keyboard-cancel-42");
    expect(keyboardCancel).toHaveAttribute("aria-label", "Cancel job #42");

    fireEvent.click(keyboardAccept);
    expect(props.onAccept).toHaveBeenCalledTimes(1);
  });

  it("provides accessible overflow menu button", () => {
    render(
      <SwipeableJobCard {...props}>
        <div>Job content</div>
      </SwipeableJobCard>
    );

    const overflowBtn = screen.getByTestId("swipe-overflow-42");
    expect(overflowBtn).toHaveAttribute("aria-haspopup", "menu");
    expect(overflowBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(overflowBtn);
    expect(overflowBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: /Quick actions for Job #42/i })).toBeInTheDocument();
  });
});
