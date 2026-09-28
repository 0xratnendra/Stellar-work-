import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ToastProvider";
import DisputesPage from "@/app/disputes/page";

const mockLoadDisputesPageData = vi.fn();

vi.mock("@/lib/disputes-loader", () => ({
  loadDisputesPageData: (...args: unknown[]) => mockLoadDisputesPageData(...args),
}));

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => ({
    wallet: "GTESTWALLET",
    connectWallet: vi.fn(),
  }),
}));

describe("Disputes page loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears spinner when the disputes request fails", async () => {
    mockLoadDisputesPageData.mockRejectedValue(new Error("network"));

    render(<ToastProvider><DisputesPage /></ToastProvider>);

    await waitFor(() =>
      expect(
        screen.getByText(/Failed to load disputes/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("retries loading after a failed request", async () => {
    mockLoadDisputesPageData
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        disputes: [
          {
            id: "D-001",
            jobId: "J-104",
            jobTitle: "Audit",
            client: "Client",
            freelancer: "Freelancer",
            amount: 100,
            raisedBy: "client",
            raisedAt: "2025-04-18T09:22:00Z",
            status: "Active",
            reason: "Test",
          },
        ],
        eligibleJobs: [],
      });

    render(<ToastProvider><DisputesPage /></ToastProvider>);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(screen.getByText("Audit")).toBeInTheDocument(),
    );
    expect(mockLoadDisputesPageData).toHaveBeenCalledTimes(2);
  });

  // TEST-27: status filter chips plus the no-results empty state.
  it("filters disputes by status and shows the no-match empty state", async () => {
    mockLoadDisputesPageData.mockResolvedValue({
      disputes: [
        { id: "D-001", jobId: "J-104", jobTitle: "Audit", client: "Client", freelancer: "Freelancer", amount: 100, raisedBy: "client", raisedAt: "2025-04-18T09:22:00Z", status: "Active", reason: "Test" },
      ],
      eligibleJobs: [],
    });

    render(<ToastProvider><DisputesPage /></ToastProvider>);
    await waitFor(() => expect(screen.getByText("Audit")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /resolved/i }));

    await waitFor(() =>
      expect(screen.getByText(/no disputes match this filter/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
  });
});
