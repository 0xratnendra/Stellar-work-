"use client";

import { useDrag } from "@use-gesture/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import AriaLiveRegion from "@/components/AriaLiveRegion";
import {
  NOOP,
  SWIPE_FULL_PX,
  SWIPE_PINNED_PX,
  animateSpringTo,
  clampSwipeOffset,
  getRevealedSwipeAction,
  isCoarsePointerDevice,
  resolveSwipeOutcome,
  triggerHapticFeedback,
  type SwipeAction,
  type SwipeActionAvailability,
} from "@/lib/swipe-actions";

const HOLD_MENU_MS = 550;
/** Pointer travel (px) that cancels a pending tap-and-hold. */
const HOLD_CANCEL_PX = 10;
/** Velocity projection window (ms) so fast flicks count as full swipes. */
const FLICK_PROJECT_MS = 100;

export interface SwipeableJobCardProps {
  jobId: number;
  /** Contextual: accept only on open jobs for a connected freelancer. */
  canAccept: boolean;
  /** Contextual: cancel only for the job's own client while it is open. */
  canCancel: boolean;
  bookmarked: boolean;
  /** Disables gestures + actions while a transaction is in flight. */
  disabled?: boolean;
  onAccept: () => void;
  onBookmark: () => void;
  onCancel: () => void;
  /**
   * Overrides device detection. By default the gesture layer only mounts
   * on coarse-pointer (touch) devices; desktop keeps hover/tap untouched.
   */
  enabled?: boolean;
  children: ReactNode;
}

const ACTION_STYLES: Record<SwipeAction, { label: string; className: string }> = {
  accept: {
    label: "Accept",
    className: "bg-green-600 text-white",
  },
  bookmark: {
    label: "Bookmark",
    className: "bg-blue-600 text-white",
  },
  cancel: {
    label: "Cancel",
    className: "bg-red-600 text-white",
  },
};

/** Subscribes to `(pointer: coarse)` changes (external system). */
function subscribeToPointerType(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return NOOP;
  }
  const mediaQuery = window.matchMedia("(pointer: coarse)");
  mediaQuery.addEventListener?.("change", onChange);
  return () => mediaQuery.removeEventListener?.("change", onChange);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest("a, button, input, textarea, select, [role='button'], [role='menuitem'], [role='link']")
  );
}

/**
 * Adds swipe quick-actions to a job card on mobile:
 *
 * - Swipe right 50px+ reveals "Accept" (green), 150px+ confirms it.
 * - Swipe left 50px+ reveals "Bookmark" (blue), 150px+ confirms "Cancel"
 *   (red) on the client's own jobs, bookmark otherwise.
 * - Springs animate the card back into place on release.
 * - Full swipes give haptic confirmation via the Vibration API.
 * - Tap-and-hold opens the same actions as a menu (accessibility fallback).
 * - Keyboard and screen reader users can trigger actions via focusable toolbar and menu.
 * - Disabled entirely on fine-pointer (desktop) devices unless enabled explicitly.
 */
export default function SwipeableJobCard({
  jobId,
  canAccept,
  canCancel,
  bookmarked,
  disabled = false,
  onAccept,
  onBookmark,
  onCancel,
  enabled,
  children,
}: SwipeableJobCardProps) {
  // Gestures mount only on touch devices; SSR/server snapshot stays false
  // so desktop keeps the plain hover/tap card (no hydration mismatch).
  const coarsePointer = useSyncExternalStore(
    subscribeToPointerType,
    isCoarsePointerDevice,
    () => false,
  );
  const gesturesEnabled = enabled ?? coarsePointer;
  const [offset, setOffset] = useState(0);
  const [pinnedSide, setPinnedSide] = useState<"left" | "right" | null>(null);
  const [holdMenuOpen, setHoldMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const offsetRef = useRef(0);
  const springCancelRef = useRef<(() => void) | null>(null);
  const lastHapticActionRef = useRef<SwipeAction | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<{ x: number; y: number } | null>(null);
  const holdTriggeredRef = useRef(false);

  const availability: SwipeActionAvailability = {
    canAccept: canAccept && !disabled,
    canCancel: canCancel && !disabled,
  };

  const setCardOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  /** Spring the card to a resting offset, cancelling any running spring. */
  const springTo = useCallback(
    (target: number, onComplete?: () => void) => {
      springCancelRef.current?.();
      springCancelRef.current = animateSpringTo(
        offsetRef.current,
        target,
        setCardOffset,
        onComplete,
      );
    },
    [setCardOffset],
  );

  useEffect(() => {
    return () => {
      springCancelRef.current?.();
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const closeCard = useCallback(() => {
    setPinnedSide(null);
    springTo(0);
  }, [springTo]);

  /** Run a quick action with confirmation haptics and reset the card. */
  const executeAction = useCallback(
    (action: SwipeAction) => {
      triggerHapticFeedback([20, 40, 20]);
      setHoldMenuOpen(false);
      setPinnedSide(null);
      springTo(0);
      if (action === "accept") {
        setAnnouncement(`Job #${jobId} accepted`);
        onAccept();
      } else if (action === "bookmark") {
        setAnnouncement(`Job #${jobId} ${bookmarked ? "bookmark removed" : "bookmarked"}`);
        onBookmark();
      } else {
        setAnnouncement(`Job #${jobId} cancelled`);
        onCancel();
      }
    },
    [bookmarked, jobId, onAccept, onBookmark, onCancel, springTo],
  );

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartRef.current = null;
  }, []);

  const bind = useDrag(
    ({ active, last, tap, movement: [mx], velocity: [vx], direction: [dx], event }) => {
      if (disabled) return;

      // Suppress swipe activation when drag starts inside an interactive child
      if (event && isInteractiveTarget(event.target)) {
        return;
      }

      // A tap while pinned open collapses the revealed action.
      if (last && tap) {
        if (pinnedSide) closeCard();
        return;
      }

      if (active) {
        clearHoldTimer();
        const clamped = clampSwipeOffset(mx, availability);
        setCardOffset(clamped);

        const revealed = getRevealedSwipeAction(clamped, availability);
        if (revealed !== lastHapticActionRef.current) {
          lastHapticActionRef.current = revealed;
          if (revealed) triggerHapticFeedback(10);
        }
        return;
      }

      if (last) {
        lastHapticActionRef.current = null;
        // Project fast flicks forward so they count as full swipes.
        const projected = offsetRef.current + vx * dx * FLICK_PROJECT_MS;
        const outcome = resolveSwipeOutcome(projected, availability);

        if (outcome.mode === "trigger" && outcome.action) {
          executeAction(outcome.action);
        } else if (outcome.mode === "reveal" && outcome.action === "accept") {
          setPinnedSide("right");
          springTo(SWIPE_PINNED_PX);
        } else if (outcome.mode === "reveal" && outcome.action) {
          setPinnedSide("left");
          springTo(-SWIPE_PINNED_PX);
        } else {
          closeCard();
        }
      }
    },
    {
      // Lock the gesture to the horizontal axis beyond a small threshold so
      // vertical scrolling of the job feed is never hijacked.
      axis: "x",
      threshold: HOLD_CANCEL_PX,
      filterTaps: true,
      pointer: { touch: true, mouse: false },
      from: () => [offsetRef.current, 0],
      enabled: gesturesEnabled && !disabled,
    },
  );

  const handleHoldStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || event.pointerType === "mouse") return;
      if (isInteractiveTarget(event.target)) return;
      holdStartRef.current = { x: event.clientX, y: event.clientY };
      holdTimerRef.current = window.setTimeout(() => {
        holdTriggeredRef.current = true;
        triggerHapticFeedback(15);
        setHoldMenuOpen(true);
      }, HOLD_MENU_MS);
    },
    [disabled],
  );

  const handleHoldMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = holdStartRef.current;
      if (!start) return;
      const movedX = event.clientX - start.x;
      const movedY = event.clientY - start.y;
      if (Math.hypot(movedX, movedY) > HOLD_CANCEL_PX) {
        clearHoldTimer();
      }
    },
    [clearHoldTimer],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Replace the native long-press context menu with the actions menu.
      event.preventDefault();
      if (disabled) return;
      holdTriggeredRef.current = true;
      triggerHapticFeedback(15);
      setHoldMenuOpen(true);
    },
    [disabled],
  );

  const handleClickCapture = useCallback(
    (event: React.SyntheticEvent<HTMLDivElement>) => {
      // Swallow the click that follows a tap-and-hold so card links don't
      // navigate when the user only wanted the actions menu.
      if (holdMenuOpen || holdTriggeredRef.current) {
        event.preventDefault();
        event.stopPropagation();
        holdTriggeredRef.current = false;
      }
    },
    [holdMenuOpen],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        setHoldMenuOpen(false);
        if (pinnedSide) closeCard();
      }
    },
    [pinnedSide, closeCard],
  );

  // Desktop / non-touch: gestures disabled, render the card untouched.
  if (!gesturesEnabled) {
    return <>{children}</>;
  }

  const revealedAction = getRevealedSwipeAction(offset, availability);
  const rightSideAction: SwipeAction =
    revealedAction === "cancel" ||
    (offset <= -SWIPE_FULL_PX && availability.canCancel)
      ? "cancel"
      : "bookmark";
  const leftPinned = pinnedSide === "left";
  const rightPinned = pinnedSide === "right";
  const interactiveUnderlay = leftPinned || rightPinned;

  return (
    <div
      className="relative h-full"
      role="group"
      aria-label={`Job #${jobId} quick actions`}
      onKeyDown={handleKeyDown}
    >
      <AriaLiveRegion message={announcement} politeness="polite" />

      {/* Accessible keyboard toolbar (visible on focus-within) */}
      <div
        className="sr-only focus-within:not-sr-only focus-within:relative focus-within:z-30 focus-within:flex focus-within:items-center focus-within:gap-2 focus-within:rounded-t-lg focus-within:border focus-within:border-slate-200 focus-within:bg-slate-50 focus-within:p-2"
        role="toolbar"
        aria-label={`Quick actions for Job #${jobId}`}
      >
        {availability.canAccept && (
          <button
            type="button"
            data-testid={`keyboard-accept-${jobId}`}
            onClick={() => executeAction("accept")}
            className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label={`Accept job #${jobId}`}
          >
            Accept job
          </button>
        )}
        <button
          type="button"
          data-testid={`keyboard-bookmark-${jobId}`}
          onClick={() => executeAction("bookmark")}
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`${bookmarked ? "Remove bookmark for" : "Bookmark"} job #${jobId}`}
        >
          {bookmarked ? "Remove bookmark" : "Bookmark job"}
        </button>
        {availability.canCancel && (
          <button
            type="button"
            data-testid={`keyboard-cancel-${jobId}`}
            onClick={() => executeAction("cancel")}
            className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Cancel job #${jobId}`}
          >
            Cancel job
          </button>
        )}
      </div>

      {/* Action layer revealed underneath the sliding card. */}
      <div
        className="absolute inset-0 flex items-stretch justify-between overflow-hidden rounded-lg"
        data-testid={`swipe-underlay-${jobId}`}
      >
        {availability.canAccept && (
          <button
            type="button"
            data-testid={`swipe-accept-${jobId}`}
            aria-label={`Accept job ${jobId}`}
            aria-hidden={!rightPinned}
            tabIndex={rightPinned ? 0 : -1}
            onClick={() => executeAction("accept")}
            className={`flex w-24 items-center justify-center px-3 text-sm font-semibold transition-opacity ${ACTION_STYLES.accept.className} ${
              offset > 0 || rightPinned ? "opacity-100" : "opacity-0"
            } ${interactiveUnderlay ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            Accept
          </button>
        )}
        <div className="flex-1" aria-hidden="true" />
        <button
          type="button"
          data-testid={`swipe-left-action-${jobId}`}
          aria-label={
            rightSideAction === "cancel"
              ? `Cancel job ${jobId}`
              : `Bookmark job ${jobId}`
          }
          aria-hidden={!leftPinned}
          tabIndex={leftPinned ? 0 : -1}
          onClick={() => executeAction(rightSideAction)}
          className={`flex items-center justify-center px-3 text-sm font-semibold transition-all ${
            rightSideAction === "cancel"
              ? `w-32 ${ACTION_STYLES.cancel.className}`
              : `w-24 ${ACTION_STYLES.bookmark.className}`
          } ${offset < 0 || leftPinned ? "opacity-100" : "opacity-0"} ${
            interactiveUnderlay ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          {rightSideAction === "cancel" ? "Cancel" : "Bookmark"}
        </button>
      </div>

      {/* Overflow menu button for keyboard / assistive tech */}
      <button
        type="button"
        data-testid={`swipe-overflow-${jobId}`}
        aria-label={`Quick actions menu for Job #${jobId}`}
        aria-haspopup="menu"
        aria-expanded={holdMenuOpen}
        onClick={() => setHoldMenuOpen((v) => !v)}
        className="sr-only focus:not-sr-only focus:absolute focus:right-2 focus:top-2 focus:z-30 focus:rounded-md focus:bg-white focus:px-2.5 focus:py-1 focus:text-xs focus:font-semibold focus:text-slate-800 focus:shadow-md focus:ring-2 focus:ring-slate-500"
      >
        Actions for Job #{jobId}
      </button>

      {/* The sliding card itself. */}
      <div
        {...bind()}
        data-testid={`swipe-card-${jobId}`}
        // `touch-action: pan-y` lets the browser own vertical scrolling of
        // the job feed while horizontal swipes belong to this gesture handler.
        className="relative h-full select-none [-webkit-touch-callout:none] [touch-action:pan-y] will-change-transform"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
        }}
        onPointerDown={handleHoldStart}
        onPointerMove={handleHoldMove}
        onPointerUp={clearHoldTimer}
        onPointerCancel={clearHoldTimer}
        onContextMenu={handleContextMenu}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {/* Tap-and-hold / overflow actions menu (accessibility fallback). */}
      {holdMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Dismiss quick actions"
            data-testid={`swipe-hold-backdrop-${jobId}`}
            className="fixed inset-0 z-40 cursor-default bg-black/30"
            onClick={() => setHoldMenuOpen(false)}
          />
          <div
            role="menu"
            aria-label={`Quick actions for Job #${jobId}`}
            className="absolute inset-x-2 top-2 z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl"
          >
            {availability.canAccept && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-green-700 hover:bg-green-50 focus:outline-none focus:bg-green-50"
                onClick={() => executeAction("accept")}
              >
                Accept job
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:bg-blue-50"
              onClick={() => executeAction("bookmark")}
            >
              {bookmarked ? "Remove bookmark" : "Bookmark job"}
            </button>
            {availability.canCancel && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:bg-red-50"
                onClick={() => executeAction("cancel")}
              >
                Cancel job
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
