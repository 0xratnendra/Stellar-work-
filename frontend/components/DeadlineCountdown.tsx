"use client";

import { useEffect, useState } from "react";
import { getDeadlineCountdown } from "@/lib/format";

interface DeadlineCountdownProps {
  deadline: string;
  className?: string;
}

const URGENCY_STYLES = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
  expired: "border-red-200 bg-red-100 text-red-800",
} as const;

export default function DeadlineCountdown({ deadline, className = "" }: DeadlineCountdownProps) {
  const [now, setNow] = useState(Date.now());
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (expired) return; // BUG-29: terminal expired state, interval stays cleared
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [expired]);

  const countdown = getDeadlineCountdown(deadline, now);

  useEffect(() => {
    if (countdown?.isExpired) setExpired(true); // BUG-29: clamp at zero
  }, [countdown?.isExpired]);

  if (!countdown) {
    return <span className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 ${className}`}>No deadline</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${URGENCY_STYLES[countdown.urgency]} ${className}`}
      title={countdown.exact}
    >
      {countdown.isExpired ? "Expired" : countdown.label}
    </span>
  );
}
