import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navigation } from "@/app/navigation";

// ─── Mutable mock refs ────────────────────────────────────────────────────────

const mockUseWallet = vi.fn();
const mockUsePathname = vi.fn();
const mockUseMessaging = vi.fn();
const mockLocale = vi.hoisted(() => ({ value: "en" }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale.value,
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const translations: Record<string, Record<string, string>> = {
      "en.nav": {
        jobs: "Jobs", postJob: "Post Job", dashboard: "Dashboard", meetings: "Meetings",
        transactions: "Transactions", disputes: "Disputes", messages: "Messages", admin: "Admin",
        profile: "Profile", mainNavigation: "Main navigation", toggleMenu: "Toggle navigation menu",
      },
      "es.nav": {
        jobs: "Trabajos", postJob: "Publicar Trabajo", dashboard: "Panel", meetings: "Reuniones",
        transactions: "Transacciones", disputes: "Disputas", messages: "Mensajes", admin: "Admin",
        profile: "Perfil", mainNavigation: "Navegación principal", toggleMenu: "Alternar menú de navegación",
      },
      "en.language": { switchTo: "Switch to {locale}", en: "English", es: "Español" },
      "es.language": { switchTo: "Cambiar a {locale}", en: "English", es: "Español" },
      "en.theme": { light: "Light mode", dark: "Dark mode", system: "System preference" },
      "es.theme": { light: "Modo claro", dark: "Modo oscuro", system: "Preferencia del sistema" },
    };
    let translated = translations[`${mockLocale.value}.${namespace}`]?.[key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) {
      translated = translated.replaceAll(`{${name}}`, value);
    }
    return translated;
  },
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
    toString: vi.fn().mockReturnValue(""),
  }),
}));

vi.mock("@/lib/wallet-context", () => ({
  useWallet: () => mockUseWallet(),
  WalletButton: () => <button type="button">Connect Wallet</button>,
}));

vi.mock("@/lib/messaging-context", () => ({
  useMessaging: () => mockUseMessaging(),
  MessagingProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/components/NetworkBadge", () => ({
  default: () => <span data-testid="network-badge">testnet</span>,
}));

vi.mock("@/components/NetworkSwitcher", () => ({
  default: () => <div data-testid="network-switcher" />,
}));

vi.mock("@/components/NotificationInbox", () => ({
  default: () => <div data-testid="notification-inbox" />,
}));

vi.mock("@/components/WalletMenu", () => ({
  default: () => <div data-testid="wallet-menu" />,
}));

vi.mock("@/components/VoiceNav", () => ({
  default: () => <div data-testid="voice-nav" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TEST_WALLET =
  "GWALLET000000000000000000000000000000000000000000000000000";
const ADMIN_WALLET =
  "GADMIN0000000000000000000000000000000000000000000000000000";

/** Grab the desktop nav region (first aria-label="Main navigation" element). */
function desktopNav() {
  return screen.getAllByRole("navigation", { name: /main navigation|navegación principal/i })[0];
}

/** Grab the mobile nav region (second aria-label="Main navigation" element when menu open). */
function mobileNav() {
  const navs = screen.getAllByRole("navigation", { name: /main navigation|navegación principal/i });
  return navs[navs.length - 1];
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Layout header navigation", () => {
  afterEach(() => {
    mockLocale.value = "en";
  });

  it("renders navigation labels from the selected locale", () => {
    mockLocale.value = "es";
    render(<Navigation />);

    const nav = desktopNav();
    expect(within(nav).getByRole("link", { name: "Trabajos" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: /^Publicar Trabajo/ })).toHaveAttribute("href", "/post-job");
    expect(within(nav).getByRole("link", { name: "Reuniones" })).toHaveAttribute("href", "/meetings");
  });

  // ─── 1. UNAUTHENTICATED NAV ──────────────────────────────────────────────────

  describe("unauthenticated nav", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUseWallet.mockReturnValue({ wallet: null, connectWallet: vi.fn() });
      mockUsePathname.mockReturnValue("/");
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
    });

    it("renders the StellarWork brand link", () => {
      render(<Navigation />);
      const brand = screen.getByRole("link", { name: "StellarWork" });
      expect(brand).toHaveAttribute("href", "/");
    });

    it("renders all core navigation links available to unauthenticated users", () => {
      render(<Navigation />);

      const nav = desktopNav();

      expect(within(nav).getByRole("link", { name: "Jobs" })).toHaveAttribute(
        "href",
        "/",
      );
      expect(
        within(nav).getByRole("link", { name: /^Post Job/ }),
      ).toHaveAttribute("href", "/post-job");
      expect(
        within(nav).getByRole("link", { name: "Dashboard" }),
      ).toHaveAttribute("href", "/dashboard");
      expect(
        within(nav).getByRole("link", { name: "Meetings" }),
      ).toHaveAttribute("href", "/meetings");
      expect(
        within(nav).getByRole("link", { name: "Transactions" }),
      ).toHaveAttribute("href", "/transactions");
      expect(
        within(nav).getByRole("link", { name: "Disputes" }),
      ).toHaveAttribute("href", "/disputes");
      expect(
        within(nav).getByRole("link", { name: /^Messages/ }),
      ).toHaveAttribute("href", "/messages");
    });

    it("does NOT render the Profile link when no wallet is connected", () => {
      render(<Navigation />);
      expect(
        screen.queryByRole("link", { name: "Profile" }),
      ).not.toBeInTheDocument();
    });

    it("does NOT render the Admin link when no wallet is connected", () => {
      render(<Navigation />);
      expect(
        screen.queryByRole("link", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });
  });

  // ─── 2. CONNECTED NAV ──────────────────────────────────────────────────────

  describe("connected nav", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUseWallet.mockReturnValue({
        wallet: TEST_WALLET,
        connectWallet: vi.fn(),
      });
      mockUsePathname.mockReturnValue("/");
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
    });

    it("renders the Profile link with the connected wallet address in the href", () => {
      render(<Navigation />);
      const profileLink = within(desktopNav()).getByRole("link", {
        name: "Profile",
      });
      expect(profileLink).toHaveAttribute("href", `/profile/${TEST_WALLET}`);
    });

    it("renders the Messages link", () => {
      render(<Navigation />);
      const msgLink = within(desktopNav()).getByRole("link", {
        name: /^Messages/,
      });
      expect(msgLink).toHaveAttribute("href", "/messages");
    });

    it("shows unread count badge on Messages link when unreadCount > 0", () => {
      mockUseMessaging.mockReturnValue({ unreadCount: 5 });
      render(<Navigation />);

      const msgLink = within(desktopNav()).getByRole("link", {
        name: /^Messages/,
      });
      const badge = within(msgLink).getByLabelText("5 unread messages");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("5");
    });

    it("shows '99+' badge when unreadCount exceeds 99", () => {
      mockUseMessaging.mockReturnValue({ unreadCount: 150 });
      render(<Navigation />);

      const msgLink = within(desktopNav()).getByRole("link", {
        name: /^Messages/,
      });
      const badge = within(msgLink).getByLabelText("150 unread messages");
      expect(badge).toHaveTextContent("99+");
    });

    it("does NOT show unread badge when unreadCount is 0", () => {
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
      render(<Navigation />);

      const msgLink = within(desktopNav()).getByRole("link", {
        name: /^Messages/,
      });
      expect(
        within(msgLink).queryByLabelText(/unread messages/),
      ).not.toBeInTheDocument();
    });
  });

  // ─── 3. ADMIN NAV ──────────────────────────────────────────────────────────

  describe("admin nav", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.clearAllMocks();
      process.env = { ...originalEnv, NEXT_PUBLIC_ADMIN_ADDRESS: ADMIN_WALLET };
      mockUsePathname.mockReturnValue("/");
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("does NOT show Admin link when wallet does not match the admin address", () => {
      mockUseWallet.mockReturnValue({
        wallet: TEST_WALLET,
        connectWallet: vi.fn(),
      });
      render(<Navigation />);

      expect(
        screen.queryByRole("link", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });

    it("shows the Admin link when wallet matches NEXT_PUBLIC_ADMIN_ADDRESS", () => {
      mockUseWallet.mockReturnValue({
        wallet: ADMIN_WALLET,
        connectWallet: vi.fn(),
      });
      render(<Navigation />);

      const adminLink = within(desktopNav()).getByRole("link", {
        name: "Admin",
      });
      expect(adminLink).toHaveAttribute("href", "/admin");
    });

    it("does NOT show the Admin link when NEXT_PUBLIC_ADMIN_ADDRESS is unset", () => {
      // Admin access is intentionally gated on a specific configured address;
      // without it, no wallet is treated as an admin.
      delete (process.env as Record<string, string | undefined>)
        .NEXT_PUBLIC_ADMIN_ADDRESS;
      mockUseWallet.mockReturnValue({
        wallet: TEST_WALLET,
        connectWallet: vi.fn(),
      });
      render(<Navigation />);

      expect(
        screen.queryByRole("link", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });

    it("does NOT show Admin link when wallet is null (even if env var is unset)", () => {
      delete (process.env as Record<string, string | undefined>)
        .NEXT_PUBLIC_ADMIN_ADDRESS;
      mockUseWallet.mockReturnValue({ wallet: null, connectWallet: vi.fn() });
      render(<Navigation />);

      expect(
        screen.queryByRole("link", { name: "Admin" }),
      ).not.toBeInTheDocument();
    });

    it("highlights Admin link as active when on /admin route", () => {
      process.env.NEXT_PUBLIC_ADMIN_ADDRESS = ADMIN_WALLET;
      mockUseWallet.mockReturnValue({
        wallet: ADMIN_WALLET,
        connectWallet: vi.fn(),
      });
      mockUsePathname.mockReturnValue("/admin");

      render(<Navigation />);

      const adminLink = within(desktopNav()).getByRole("link", {
        name: "Admin",
      });
      expect(adminLink).toHaveClass("font-semibold");
    });
  });

  // ─── 4. MOBILE MENU TOGGLE ─────────────────────────────────────────────────

  describe("mobile menu toggle", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUseWallet.mockReturnValue({ wallet: null, connectWallet: vi.fn() });
      mockUsePathname.mockReturnValue("/");
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
    });

    it("starts with the mobile menu closed", () => {
      render(<Navigation />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("opens the mobile menu on toggle click", () => {
      render(<Navigation />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      // Desktop nav is always present; mobile nav region appears when open.
      const navs = screen.getAllByRole("navigation", {
        name: "Main navigation",
      });
      expect(navs.length).toBeGreaterThanOrEqual(2);
    });

    it("closes the mobile menu on second toggle click", () => {
      render(<Navigation />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("renders all links inside the mobile menu when open", () => {
      render(<Navigation />);
      fireEvent.click(
        screen.getByRole("button", { name: /Toggle navigation menu/ }),
      );

      const mobile = mobileNav();
      expect(within(mobile).getByRole("link", { name: "Jobs" })).toBeInTheDocument();
      expect(
        within(mobile).getByRole("link", { name: /^Post Job/ }),
      ).toBeInTheDocument();
      expect(
        within(mobile).getByRole("link", { name: "Dashboard" }),
      ).toBeInTheDocument();
      expect(
        within(mobile).getByRole("link", { name: "Disputes" }),
      ).toBeInTheDocument();
    });

    it("closes mobile menu when a link is clicked", () => {
      render(<Navigation />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(within(mobileNav()).getByRole("link", { name: "Jobs" }));
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("closes the mobile menu when the route (pathname) changes", () => {
      mockUsePathname.mockReturnValue("/");
      const { rerender } = render(<Navigation key="route-close" />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      // Simulate navigation to another route. The Navigation component watches
      // the pathname via usePathname and closes the menu on change.
      mockUsePathname.mockReturnValue("/dashboard");
      rerender(<Navigation key="route-close-2" />);

      expect(
        screen.getByRole("button", { name: /Toggle navigation menu/ }),
      ).toHaveAttribute("aria-expanded", "false");
    });

    it("closes mobile menu when the Escape key is pressed", () => {
      render(<Navigation />);
      const toggle = screen.getByRole("button", {
        name: /Toggle navigation menu/,
      });

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.keyDown(document, { key: "Escape" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("includes wallet connect button inside the mobile menu", () => {
      render(<Navigation />);
      fireEvent.click(
        screen.getByRole("button", { name: /Toggle navigation menu/ }),
      );

      // WalletButton renders a "Connect Wallet" button in the mobile drawer.
      expect(
        screen.getByRole("button", { name: "Connect Wallet" }),
      ).toBeInTheDocument();
    });
  });

  // ─── 5. ACTIVE LINK HIGHLIGHTING ────────────────────────────────────────────

  describe("active link highlighting", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUseWallet.mockReturnValue({ wallet: null, connectWallet: vi.fn() });
      mockUseMessaging.mockReturnValue({ unreadCount: 0 });
    });

    it("highlights the active route with font-semibold class", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<Navigation />);

      const nav = desktopNav();
      const dashboardLink = within(nav).getByRole("link", {
        name: "Dashboard",
      });
      const jobsLink = within(nav).getByRole("link", { name: "Jobs" });

      expect(dashboardLink).toHaveClass("font-semibold");
      expect(jobsLink).not.toHaveClass("font-semibold");
    });

    it("marks home (Jobs) link active only on exact root path '/'", () => {
      mockUsePathname.mockReturnValue("/disputes");
      render(<Navigation />);

      const nav = desktopNav();
      expect(
        within(nav).getByRole("link", { name: "Jobs" }),
      ).not.toHaveClass("font-semibold");
      expect(
        within(nav).getByRole("link", { name: "Disputes" }),
      ).toHaveClass("font-semibold");
    });

    it("highlights Post Job link when on /post-job", () => {
      mockUsePathname.mockReturnValue("/post-job");
      render(<Navigation />);

      const postJobLink = within(desktopNav()).getByRole("link", {
        name: /^Post Job/,
      });
      expect(postJobLink).toHaveClass("font-semibold");
    });

    it("highlights Meetings link when on /meetings", () => {
      mockUsePathname.mockReturnValue("/meetings");
      render(<Navigation />);

      expect(
        within(desktopNav()).getByRole("link", { name: "Meetings" }),
      ).toHaveClass("font-semibold");
    });
    // Navigation is memoized; a remount makes the mocked wallet take effect.
    it("highlights Transactions link when on /transactions", () => {
      mockUsePathname.mockReturnValue("/transactions");
      render(<Navigation />);

      expect(
        within(desktopNav()).getByRole("link", { name: "Transactions" }),
      ).toHaveClass("font-semibold");
    });

    it("highlights Disputes link when on /disputes", () => {
      mockUsePathname.mockReturnValue("/disputes");
      render(<Navigation />);

      expect(
        within(desktopNav()).getByRole("link", { name: "Disputes" }),
      ).toHaveClass("font-semibold");
    });

    it("highlights Messages link when on /messages", () => {
      mockUsePathname.mockReturnValue("/messages");
      render(<Navigation />);

      expect(
        within(desktopNav()).getByRole("link", { name: /^Messages/ }),
      ).toHaveClass("font-semibold");
    });

    it("highlights Dashboard link when on /dashboard sub-route", () => {
      mockUsePathname.mockReturnValue("/dashboard/settings");
      render(<Navigation />);

      expect(
        within(desktopNav()).getByRole("link", { name: "Dashboard" }),
      ).toHaveClass("font-semibold");
    });

    it("sets aria-current='page' on the active link", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<Navigation />);

      const dashboardLink = within(desktopNav()).getByRole("link", {
        name: "Dashboard",
      });
      expect(dashboardLink).toHaveAttribute("aria-current", "page");
    });

    it("does NOT set aria-current on inactive links", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<Navigation />);

      const jobsLink = within(desktopNav()).getByRole("link", {
        name: "Jobs",
      });
      expect(jobsLink).not.toHaveAttribute("aria-current");
    });

    it("highlights active links in the mobile menu too", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<Navigation />);

      fireEvent.click(
        screen.getByRole("button", { name: /Toggle navigation menu/ }),
      );

      const dashboardLink = within(mobileNav()).getByRole("link", {
        name: "Dashboard",
      });
      expect(dashboardLink).toHaveClass("font-semibold");
    });
  });
});
