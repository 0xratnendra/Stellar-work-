"use client";

import { useNotifications, getEventLabel } from "@/lib/notifications-context";
import { useModalFocusTrap } from "@/lib/modal";
import AriaLiveRegion from "@/components/AriaLiveRegion";
import type { NotificationEvent } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function NotificationInbox() {
  const {
    notifications,
    unreadCount,
    markAsSeen,
    markAllAsSeen,
    preferences,
    setPreference,
    clearNotifications,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const prevCountRef = useRef(notifications.length);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (notifications.length > prevCountRef.current) {
      const newest = notifications[0];
      if (newest) {
        setAnnouncement(`New notification: ${getEventLabel(newest.event)}. ${newest.message}`);
      }
    }
    prevCountRef.current = notifications.length;
  }, [notifications]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setShowPrefs(false);
    setFocusedIndex(-1);
  }, []);

  useModalFocusTrap(open, dropdownRef, handleClose);

  const allEvents = Object.keys(preferences) as NotificationEvent[];

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const listCount = Math.min(notifications.length, 50);
    if (listCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (focusedIndex + 1) % listCount;
      setFocusedIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (focusedIndex - 1 + listCount) % listCount;
      setFocusedIndex(prevIndex);
      itemRefs.current[prevIndex]?.focus();
    }
  };

  return (
    <div className="relative">
      <AriaLiveRegion message={announcement} politeness="polite" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            <span className="sr-only">Unread count: </span>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label="Notification inbox"
          aria-modal="true"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
          tabIndex={-1}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowPrefs((v) => !v);
                }}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                aria-label="Notification preferences"
              >
                Settings
              </button>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllAsSeen();
                    setAnnouncement("All notifications marked as seen");
                  }}
                  className="rounded-md px-2 py-1 text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  aria-label="Mark all notifications as seen"
                >
                  Mark all seen
                </button>
              )}
            </div>
          </div>

          {showPrefs ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">Notify me when:</p>
              {allEvents.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={preferences[event]}
                    onChange={(e) => setPreference(event, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {getEventLabel(event)}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setShowPrefs(false)}
                className="mt-2 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                Done
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500" role="status">
              No notifications yet.
            </div>
          ) : (
            <ul
              role="list"
              className="max-h-80 overflow-y-auto divide-y divide-slate-100"
              aria-label="Notifications list"
              onKeyDown={handleListKeyDown}
            >
              {notifications.slice(0, 50).map((n, idx) => {
                const eventLabel = getEventLabel(n.event) || n.event;
                return (
                  <li key={n.id} role="listitem" className="relative group">
                    <div className="flex items-center justify-between">
                      <Link
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        href={`/job/${n.jobId}`}
                        className={`flex-1 flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                          !n.seen ? "bg-blue-50/50" : ""
                        }`}
                        aria-label={`${!n.seen ? "Unread notification: " : ""}${eventLabel}. ${n.message}. ${new Date(n.timestamp).toLocaleString()}`}
                        aria-current={!n.seen ? "true" : undefined}
                        onClick={() => {
                          markAsSeen(n.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-900">
                              {eventLabel}
                            </p>
                            {!n.seen && (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                                <span className="sr-only">Status: </span>
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {new Date(n.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {!n.seen && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                        )}
                      </Link>
                      {!n.seen && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAsSeen(n.id);
                            setAnnouncement(`Notification marked as read: ${eventLabel}`);
                          }}
                          className="mr-3 p-1.5 text-xs text-slate-400 hover:text-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`Mark as read: ${eventLabel}`}
                          title="Mark as read"
                        >
                          <span className="sr-only">Mark as read</span>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {notifications.length > 0 && !showPrefs && (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  clearNotifications();
                  setAnnouncement("All notifications cleared");
                }}
                className="w-full rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-400"
                aria-label="Clear all notifications"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
