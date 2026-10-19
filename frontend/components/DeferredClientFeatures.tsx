"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Client-only features deferred until after hydration. They live in their own
// client component because `ssr: false` with next/dynamic is not permitted
// inside a Server Component (the root layout is async/server-rendered).
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="min-h-[21rem] w-full max-w-lg overflow-hidden rounded-xl bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:bg-slate-900">
        <p role="status" className="text-sm text-slate-500">Loading commands...</p>
      </div>
    </div>
  ),
});
const ShortcutCheatSheet = dynamic(() => import("@/components/ShortcutCheatSheet"), { ssr: false });
const OnboardingProvider = dynamic(() => import("@/components/OnboardingProvider"), { ssr: false });
const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), { ssr: false });
const ServiceWorkerRegistration = dynamic(() => import("@/components/ServiceWorkerRegistration"), { ssr: false });
const AnnouncementBanner = dynamic(() => import("@/components/AnnouncementBanner"), { ssr: false });

export default function DeferredClientFeatures() {
  const [commandPaletteRequested, setCommandPaletteRequested] = useState(false);

  useEffect(() => {
    if (commandPaletteRequested) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteRequested(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteRequested]);

  return (
    <>
      <ServiceWorkerRegistration />
      <AnnouncementBanner />
      {commandPaletteRequested && <CommandPalette initialOpen />}
      <ShortcutCheatSheet />
      <OnboardingProvider />
      <InstallPrompt />
    </>
  );
}
