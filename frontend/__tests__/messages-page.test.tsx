import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessagesIndexPage from "@/app/messages/page";
import MessageThreadPage from "@/app/messages/[address]/page";
import { MessagingProvider } from "@/lib/messaging-context";
import {
  sendMessage,
  deleteMessage,
  reportMessage,
  type ConversationMeta,
} from "@/lib/messaging";

const TEST_MY_ADDRESS =
  "GA2MYWALLETADDRESS1234567890ABCDEF1234567890ABCDEF123456";
const TEST_PEER_VALID =
  "GB1PEERVALIDADDRESS1234567890ABCDEF1234567890ABCDEF1234";

let mockParamsAddress = TEST_PEER_VALID;

vi.mock("next/navigation", () => ({
  useParams: () => ({ address: mockParamsAddress }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => ({
    wallet: TEST_MY_ADDRESS,
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
  }),
}));

// Mock CallButton and CallHistory to simplify page rendering
vi.mock("@/components/CallButton", () => ({
  default: () => <button type="button">Call</button>,
}));
vi.mock("@/components/CallHistory", () => ({
  default: () => <div data-testid="call-history" />,
}));

describe("Messages Page & Thread View", () => {
  beforeEach(() => {
    localStorage.clear();
    mockParamsAddress = TEST_PEER_VALID;
    vi.clearAllMocks();
  });

  describe("Messages Index Page (/messages)", () => {
    it("renders empty state when there are no conversations", () => {
      render(
        <MessagingProvider>
          <MessagesIndexPage />
        </MessagingProvider>,
      );

      expect(screen.getByText("No messages yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Start a conversation from a job listing or someone's profile page.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Browse Jobs" }),
      ).toBeInTheDocument();
    });

    it("renders conversation list with snippet, timestamp, and unread badge", () => {
      const convos: ConversationMeta[] = [
        {
          peerAddress: TEST_PEER_VALID,
          lastMessageAt: Date.now(),
          lastMessageSnippet: "Can you provide an update on milestone 2?",
          lastMessageFrom: TEST_PEER_VALID,
          unreadCount: 2,
        },
      ];

      localStorage.setItem(
        `sw:msg:conversations:${TEST_MY_ADDRESS}`,
        JSON.stringify(convos),
      );

      render(
        <MessagingProvider>
          <MessagesIndexPage />
        </MessagingProvider>,
      );

      expect(
        screen.getByText("Can you provide an update on milestone 2?"),
      ).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("Message Thread Page (/messages/[address])", () => {
    it("handles invalid or malformed recipient address with error alert", () => {
      mockParamsAddress = "INVALID_NOT_A_STELLAR_ADDRESS";

      render(
        <MessagingProvider>
          <MessageThreadPage />
        </MessagingProvider>,
      );

      expect(screen.getByText("Invalid address")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The address in the URL is not a valid Stellar public key.",
        ),
      ).toBeInTheDocument();
    });

    it("renders valid thread with messages, soft-deleted notice, and reported flag", () => {
      // Seed messages
      const msg1 = sendMessage(
        TEST_PEER_VALID,
        TEST_MY_ADDRESS,
        "First message from peer",
      );
      const msg2 = sendMessage(
        TEST_MY_ADDRESS,
        TEST_PEER_VALID,
        "Response from me",
      );
      const msg3 = sendMessage(
        TEST_PEER_VALID,
        TEST_MY_ADDRESS,
        "Message to be soft deleted",
      );
      const msg4 = sendMessage(
        TEST_PEER_VALID,
        TEST_MY_ADDRESS,
        "Message flagged as reported",
      );

      deleteMessage(TEST_MY_ADDRESS, TEST_PEER_VALID, msg3.id);
      reportMessage(TEST_MY_ADDRESS, TEST_PEER_VALID, msg4.id);

      render(
        <MessagingProvider>
          <MessageThreadPage />
        </MessagingProvider>,
      );

      expect(screen.getByText("First message from peer")).toBeInTheDocument();
      expect(screen.getByText("Response from me")).toBeInTheDocument();
      expect(screen.getByText("Message deleted")).toBeInTheDocument();
      expect(screen.getByText("⚑ Reported")).toBeInTheDocument();
    });

    it("validates composer states and disables submit button when empty or sending", () => {
      render(
        <MessagingProvider>
          <MessageThreadPage />
        </MessagingProvider>,
      );

      const textarea = screen.getByLabelText("Message body");
      const sendButton = screen.getByLabelText("Send message");

      // Initial state: empty -> send button is disabled
      expect(sendButton).toBeDisabled();

      // Type whitespace only -> still disabled
      fireEvent.change(textarea, { target: { value: "   " } });
      expect(sendButton).toBeDisabled();

      // Type valid message text -> send button is enabled
      fireEvent.change(textarea, {
        target: { value: "Hello! Testing the composer." },
      });
      expect(sendButton).not.toBeDisabled();

      // Character count remaining is displayed
      const charCounter = screen.getByText("1971"); // 2000 - 29 chars
      expect(charCounter).toBeInTheDocument();
    });

    it("sends message, updates thread view, and clears composer", async () => {
      render(
        <MessagingProvider>
          <MessageThreadPage />
        </MessagingProvider>,
      );

      const textarea = screen.getByLabelText("Message body");
      const sendButton = screen.getByLabelText("Send message");

      fireEvent.change(textarea, {
        target: { value: "A new message from the test composer" },
      });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(
          screen.getByText("A new message from the test composer"),
        ).toBeInTheDocument();
      });

      // Textarea should be reset
      expect(textarea).toHaveValue("");
    });

    it("asserts accessibility attributes and live regions for incoming messages", () => {
      render(
        <MessagingProvider>
          <MessageThreadPage />
        </MessagingProvider>,
      );

      // Thread has role="log" and aria-live="polite"
      const threadContainer = screen.getByRole("log", {
        name: "Message thread",
      });
      expect(threadContainer).toBeInTheDocument();
      expect(threadContainer).toHaveAttribute("aria-live", "polite");

      // Form accessible landmarks
      expect(
        screen.getByRole("form", { name: "Compose message" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Message body")).toBeInTheDocument();
    });
  });
});
