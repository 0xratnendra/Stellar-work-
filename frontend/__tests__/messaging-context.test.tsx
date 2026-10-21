import React from "react";
import { render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingProvider, useMessaging } from "@/lib/messaging-context";
import {
  sendMessage,
  markThreadAsRead,
  loadConversations,
  loadThread,
  countTotalUnread,
  type ConversationMeta,
} from "@/lib/messaging";

const TEST_MY_ADDRESS =
  "GA2MYWALLETADDRESS1234567890ABCDEF1234567890ABCDEF123456";
const TEST_PEER_ADDRESS_1 =
  "GB1PEERWALLETADDRESS1234567890ABCDEF1234567890ABCDEF1234";
const TEST_PEER_ADDRESS_2 =
  "GC2PEERWALLETADDRESS1234567890ABCDEF1234567890ABCDEF1234";

let currentWallet: string | null = TEST_MY_ADDRESS;

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => ({
    wallet: currentWallet,
  }),
}));

function MessagingTestConsumer({
  onMount,
}: {
  onMount: (ctx: ReturnType<typeof useMessaging>) => void;
}) {
  const ctx = useMessaging();
  React.useEffect(() => {
    onMount(ctx);
  }, [ctx, onMount]);

  return (
    <div>
      <span data-testid="total-unread">{ctx.unreadCount}</span>
      <button type="button" onClick={ctx.refreshUnread}>
        Refresh
      </button>
    </div>
  );
}

describe("Messaging Context & Unread Derivations", () => {
  beforeEach(() => {
    localStorage.clear();
    currentWallet = TEST_MY_ADDRESS;
    vi.clearAllMocks();
  });

  it("initializes with zero unread when no messages exist", () => {
    let contextValue!: ReturnType<typeof useMessaging>;

    render(
      <MessagingProvider>
        <MessagingTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MessagingProvider>,
    );

    expect(contextValue.unreadCount).toBe(0);
    expect(screen.getByTestId("total-unread")).toHaveTextContent("0");
  });

  it("handles sending, receiving, and unread-count derivation across conversations", () => {
    let contextValue!: ReturnType<typeof useMessaging>;

    render(
      <MessagingProvider>
        <MessagingTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MessagingProvider>,
    );

    // 1. Peer 1 sends a message to MY address -> MY address receives +1 unread
    act(() => {
      sendMessage(TEST_PEER_ADDRESS_1, TEST_MY_ADDRESS, "Hello from Peer 1!");
      contextValue.refreshUnread();
    });

    expect(countTotalUnread(TEST_MY_ADDRESS)).toBe(1);
    expect(contextValue.unreadCount).toBe(1);

    // 2. Peer 2 sends two messages to MY address -> total unread should be 3
    act(() => {
      sendMessage(
        TEST_PEER_ADDRESS_2,
        TEST_MY_ADDRESS,
        "Message 1 from Peer 2",
      );
      sendMessage(
        TEST_PEER_ADDRESS_2,
        TEST_MY_ADDRESS,
        "Message 2 from Peer 2",
      );
      contextValue.refreshUnread();
    });

    expect(countTotalUnread(TEST_MY_ADDRESS)).toBe(3);
    expect(contextValue.unreadCount).toBe(3);

    // 3. MY address sends a message back to Peer 1 -> does not increase MY unread count
    act(() => {
      sendMessage(TEST_MY_ADDRESS, TEST_PEER_ADDRESS_1, "Replying to Peer 1");
      contextValue.refreshUnread();
    });

    expect(contextValue.unreadCount).toBe(3);

    // 4. Mark Peer 2 conversation as read -> unread for Peer 2 becomes 0, total becomes 1
    act(() => {
      markThreadAsRead(TEST_MY_ADDRESS, TEST_PEER_ADDRESS_2);
      contextValue.refreshUnread();
    });

    expect(countTotalUnread(TEST_MY_ADDRESS)).toBe(1);
    expect(contextValue.unreadCount).toBe(1);

    // 5. Mark Peer 1 conversation as read -> total unread becomes 0
    act(() => {
      markThreadAsRead(TEST_MY_ADDRESS, TEST_PEER_ADDRESS_1);
      contextValue.refreshUnread();
    });

    expect(countTotalUnread(TEST_MY_ADDRESS)).toBe(0);
    expect(contextValue.unreadCount).toBe(0);
  });

  it("persists conversation state in localStorage and restores upon reload", () => {
    const existingConvos: ConversationMeta[] = [
      {
        peerAddress: TEST_PEER_ADDRESS_1,
        lastMessageAt: Date.now(),
        lastMessageSnippet: "Existing message from storage",
        lastMessageFrom: TEST_PEER_ADDRESS_1,
        unreadCount: 4,
      },
    ];

    localStorage.setItem(
      `sw:msg:conversations:${TEST_MY_ADDRESS}`,
      JSON.stringify(existingConvos),
    );

    let contextValue!: ReturnType<typeof useMessaging>;

    render(
      <MessagingProvider>
        <MessagingTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MessagingProvider>,
    );

    // Verified that unread state was restored from localStorage
    expect(contextValue.unreadCount).toBe(4);
    expect(screen.getByTestId("total-unread")).toHaveTextContent("4");

    const convos = loadConversations(TEST_MY_ADDRESS);
    expect(convos).toHaveLength(1);
    expect(convos[0].lastMessageSnippet).toBe("Existing message from storage");
  });

  it("reacts to cross-tab storage events", () => {
    let contextValue!: ReturnType<typeof useMessaging>;

    render(
      <MessagingProvider>
        <MessagingTestConsumer onMount={(ctx) => (contextValue = ctx)} />
      </MessagingProvider>,
    );

    expect(contextValue.unreadCount).toBe(0);

    // Simulate cross-tab event writing to storage
    act(() => {
      sendMessage(TEST_PEER_ADDRESS_1, TEST_MY_ADDRESS, "Cross tab update");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: `sw:msg:thread:${TEST_MY_ADDRESS}:${TEST_PEER_ADDRESS_1}`,
        }),
      );
    });

    expect(contextValue.unreadCount).toBe(1);
  });
});
