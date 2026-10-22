import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandPalette from "@/components/CommandPalette";
import ConfirmDialog from "@/components/ConfirmDialog";
import ShortcutCheatSheet from "@/components/ShortcutCheatSheet";

const mockPush = vi.fn();
const mockConnectWallet = vi.fn();
const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("Command palette interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      wallet: null,
      connectWallet: mockConnectWallet,
    });
  });

  it("opens and closes with keyboard shortcuts", () => {
    render(<CommandPalette />);

    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });

  it("opens immediately when mounted after the first shortcut", () => {
    render(<CommandPalette initialOpen />);

    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
  });

  it("has accessible combobox and listbox ARIA attributes", () => {
    render(<CommandPalette initialOpen />);

    const combobox = screen.getByRole("combobox", { name: "Search commands" });
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(combobox).toHaveAttribute(
      "aria-controls",
      "command-palette-results",
    );
    expect(combobox).toHaveAttribute("aria-autocomplete", "list");

    const listbox = screen.getByRole("listbox", { name: "Commands" });
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute("id", "command-palette-results");

    const activeId = combobox.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();

    const activeOption = document.getElementById(activeId!);
    expect(activeOption).toBeInTheDocument();
    expect(activeOption).toHaveAttribute("aria-selected", "true");

    const statusLiveRegion = screen.getByRole("status");
    expect(statusLiveRegion).toHaveAttribute("aria-live", "polite");
    expect(statusLiveRegion.textContent).toMatch(/commands found/i);
  });

  it("supports Home, End, and Arrow key navigation", () => {
    render(<CommandPalette initialOpen />);

    const combobox = screen.getByRole("combobox", { name: "Search commands" });

    // Move to end with End key
    fireEvent.keyDown(document, { key: "End" });
    const endActiveId = combobox.getAttribute("aria-activedescendant");
    expect(
      document.getElementById(endActiveId!)?.getAttribute("aria-selected"),
    ).toBe("true");

    // Move to start with Home key
    fireEvent.keyDown(document, { key: "Home" });
    const homeActiveId = combobox.getAttribute("aria-activedescendant");
    expect(
      document.getElementById(homeActiveId!)?.getAttribute("aria-selected"),
    ).toBe("true");

    // Move down with ArrowDown
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const nextActiveId = combobox.getAttribute("aria-activedescendant");
    expect(nextActiveId).not.toBe(homeActiveId);
  });

  it("filters commands by search query", () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    const searchInput = screen.getByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(searchInput, { target: { value: "dashboard" } });

    expect(
      screen.getByRole("option", { name: "Go to Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Go to Jobs" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Post Job" }),
    ).not.toBeInTheDocument();
  });

  it("executes the selected command action", () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.click(screen.getByRole("option", { name: "Post Job" }));

    expect(mockPush).toHaveBeenCalledWith("/post-job");
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });

  it("runs connect wallet action when selected", () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.click(screen.getByRole("option", { name: "Connect Wallet" }));

    expect(mockConnectWallet).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });

  it("closes confirmation dialogs with Escape and confirms with Enter", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete job"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("opens the keyboard shortcut sheet with an accessible list", () => {
    render(<ShortcutCheatSheet />);

    fireEvent.keyDown(window, { key: "?" });

    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /keyboard shortcut overview/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Submit form or confirm action"),
    ).toBeInTheDocument();
  });
});
