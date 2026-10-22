"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useRef, useState } from "react";
import AriaLiveRegion from "@/components/AriaLiveRegion";
import { useModalFocusTrap } from "@/lib/modal";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip all HTML tags and return plain text for byte-length accounting. */
export function htmlToPlainText(html: string): string {
  // Replace block-level separators with newlines, then strip remaining tags.
  return html
    .replace(/<\/?(p|h[1-6]|li|ul|ol|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Toolbar button ────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  tabIndex,
  onKeyDown,
  buttonRef,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        // Prevent editor from losing focus on toolbar click
        e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-slate-800 text-white"
          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── Component props ───────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  /** Current HTML value (controlled). */
  value: string;
  /** Called with the new HTML string whenever content changes. */
  onChange: (html: string) => void;
  /** Maximum allowed bytes for the plain-text equivalent. */
  maxBytes?: number;
  /** Field-level error message to display below the editor. */
  error?: string;
  /** Error id for aria-describedby */
  errorId?: string;
  /** Accessible label id that labels this editor (from the wrapping <label>). */
  labelId?: string;
  /** Whether the field is required. */
  required?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  maxBytes = 4096,
  error,
  errorId,
  labelId,
  required,
}: RichTextEditorProps) {
  const [announcement, setAnnouncement] = useState("");
  const [focusedToolbarIndex, setFocusedToolbarIndex] = useState(0);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkInputError, setLinkInputError] = useState("");
  const linkModalRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const toolbarButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Descriptions are embedded below the page h1, so only h2 is exposed.
        heading: { levels: [2] },
        // Disable unsupported extensions
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-blue-600 underline",
        },
        validate: (href) => /^https?:\/\//i.test(href),
      }),
      Placeholder.configure({
        placeholder: "Describe the job in detail — requirements, deliverables, skills needed…",
      }),
    ],
    content: value,
    onUpdate({ editor }) {
      // Emit empty string when the doc is empty to simplify validation
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(required ? { "aria-required": "true" } : {}),
        ...(error ? { "aria-invalid": "true" } : {}),
        "aria-describedby": [errorId, "rich-text-editor-instructions"].filter(Boolean).join(" "),
        ...(labelId ? { "aria-labelledby": labelId } : { "aria-label": "Job description" }),
        class: [
          "min-h-[9rem] w-full px-3 py-2 text-sm text-slate-900 outline-none",
          "prose prose-sm max-w-none",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2",
          "[&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_.is-editor-empty_p:first-child]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty_p:first-child]:before:text-slate-400",
          "[&_.is-editor-empty_p:first-child]:before:pointer-events-none",
          "[&_.is-editor-empty_p:first-child]:before:float-left",
          "[&_.is-editor-empty_p:first-child]:before:h-0",
        ].join(" "),
      },
    },
  });

  // Sync external value changes (e.g. form reset) without causing update loops
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  // Modal focus trap for link dialog
  useModalFocusTrap(linkModalOpen, linkModalRef, () => setLinkModalOpen(false), {
    initialFocusRef: linkInputRef,
  });

  // ── Toolbar keyboard navigation (Roving Tabindex) ───────────────────────────
  const TOTAL_TOOLBAR_BUTTONS = 6;

  const handleToolbarKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (index + 1) % TOTAL_TOOLBAR_BUTTONS;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (index - 1 + TOTAL_TOOLBAR_BUTTONS) % TOTAL_TOOLBAR_BUTTONS;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = TOTAL_TOOLBAR_BUTTONS - 1;
      } else {
        return;
      }
      setFocusedToolbarIndex(nextIndex);
      toolbarButtonsRef.current[nextIndex]?.focus();
    },
    [],
  );

  // ── Formatting actions with announcements ──────────────────────────────────
  const toggleHeadingAction = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    const isActive = editor.isActive("heading", { level: 2 });
    setAnnouncement(isActive ? "Heading level 2 applied" : "Heading level 2 removed");
  }, [editor]);

  const toggleBoldAction = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleBold().run();
    const isActive = editor.isActive("bold");
    setAnnouncement(isActive ? "Bold formatting enabled" : "Bold formatting disabled");
  }, [editor]);

  const toggleItalicAction = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleItalic().run();
    const isActive = editor.isActive("italic");
    setAnnouncement(isActive ? "Italic formatting enabled" : "Italic formatting disabled");
  }, [editor]);

  const toggleBulletListAction = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleBulletList().run();
    const isActive = editor.isActive("bulletList");
    setAnnouncement(isActive ? "Bullet list inserted" : "Bullet list removed");
  }, [editor]);

  const toggleOrderedListAction = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleOrderedList().run();
    const isActive = editor.isActive("orderedList");
    setAnnouncement(isActive ? "Numbered list inserted" : "Numbered list removed");
  }, [editor]);

  // ── Link helpers ────────────────────────────────────────────────────────────
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previous ?? "https://");
    setLinkInputError("");
    setLinkModalOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl || linkUrl.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setAnnouncement("Link removed");
      setLinkModalOpen(false);
      return;
    }
    if (!/^https?:\/\//i.test(linkUrl)) {
      setLinkInputError("URL must start with http:// or https://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    setAnnouncement("Link applied");
    setLinkModalOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setAnnouncement("Link removed");
    setLinkModalOpen(false);
  }, [editor]);

  // ── Byte / char accounting ───────────────────────────────────────────────────
  const plainText = value ? htmlToPlainText(value) : "";
  const byteCount = new TextEncoder().encode(plainText).length;
  const isOverLimit = byteCount > maxBytes;
  const pct = Math.min(100, Math.round((byteCount / maxBytes) * 100));

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!editor) return null;

  return (
    <div className="space-y-1">
      <AriaLiveRegion message={announcement} politeness="polite" />

      <p id="rich-text-editor-instructions" className="sr-only">
        Rich text editor. Use Ctrl+B for bold, Ctrl+I for italic. Navigate toolbar using left and right arrow keys. Press Shift+Tab from editor to reach formatting toolbar.
      </p>

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-slate-300 bg-slate-50 px-1.5 py-1"
        role="toolbar"
        aria-label="Text formatting toolbar"
        aria-controls="rich-text-editor-content"
      >
        {/* Headings */}
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[0] = el; }}
          tabIndex={focusedToolbarIndex === 0 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 0)}
          title="Heading level 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={toggleHeadingAction}
        >
          H
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        {/* Inline marks */}
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[1] = el; }}
          tabIndex={focusedToolbarIndex === 1 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 1)}
          title="Bold (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={toggleBoldAction}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[2] = el; }}
          tabIndex={focusedToolbarIndex === 2 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 2)}
          title="Italic (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={toggleItalicAction}
        >
          <em>I</em>
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        {/* Lists */}
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[3] = el; }}
          tabIndex={focusedToolbarIndex === 3 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 3)}
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={toggleBulletListAction}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="4" r="1.5" />
            <rect x="5" y="3" width="10" height="2" rx="1" />
            <circle cx="2" cy="8" r="1.5" />
            <rect x="5" y="7" width="10" height="2" rx="1" />
            <circle cx="2" cy="12" r="1.5" />
            <rect x="5" y="11" width="10" height="2" rx="1" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[4] = el; }}
          tabIndex={focusedToolbarIndex === 4 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 4)}
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={toggleOrderedListAction}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <text x="0" y="5" fontSize="6" fontFamily="sans-serif">1.</text>
            <rect x="5" y="3" width="10" height="2" rx="1" />
            <text x="0" y="9.5" fontSize="6" fontFamily="sans-serif">2.</text>
            <rect x="5" y="7" width="10" height="2" rx="1" />
            <text x="0" y="14" fontSize="6" fontFamily="sans-serif">3.</text>
            <rect x="5" y="11" width="10" height="2" rx="1" />
          </svg>
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        {/* Link */}
        <ToolbarButton
          buttonRef={(el) => { toolbarButtonsRef.current[5] = el; }}
          tabIndex={focusedToolbarIndex === 5 ? 0 : -1}
          onKeyDown={(e) => handleToolbarKeyDown(e, 5)}
          title="Insert or edit link"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M6.5 9.5a4.5 4.5 0 0 0 6.364 0l1.5-1.5a4.5 4.5 0 0 0-6.364-6.364L7.172 3" strokeLinecap="round" />
            <path d="M9.5 6.5a4.5 4.5 0 0 0-6.364 0l-1.5 1.5a4.5 4.5 0 0 0 6.364 6.364L8.828 13" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <div
        id="rich-text-editor-content"
        className={[
          "rounded-b-md border border-slate-300 bg-white",
          "focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500",
          error ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500" : "",
        ].join(" ")}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Character / byte counter */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 select-none">
          Supports <strong>bold</strong>, <em>italic</em>, headings, lists, and links
        </span>
        <span
          className={isOverLimit ? "font-medium text-red-600" : "text-slate-400"}
          aria-live="polite"
          aria-atomic="true"
        >
          {byteCount.toLocaleString()} / {maxBytes.toLocaleString()} bytes
          {isOverLimit && (
            <>
              {" "}
              <span className="sr-only">— over the limit</span>
              <span aria-hidden="true">⚠</span>
            </>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className={[
            "h-full rounded-full transition-all duration-200",
            pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-blue-400",
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Accessible link dialog */}
      {linkModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            aria-hidden="true"
            onClick={() => setLinkModalOpen(false)}
          />
          <div
            ref={linkModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Insert or edit link"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">Insert / Edit Link</h3>
            <div>
              <label htmlFor="editor-link-input" className="block text-xs font-medium text-slate-700 mb-1">
                Link URL
              </label>
              <input
                ref={linkInputRef}
                id="editor-link-input"
                type="url"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkInputError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="https://example.com"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                aria-describedby={linkInputError ? "editor-link-error" : undefined}
                aria-invalid={Boolean(linkInputError)}
              />
              {linkInputError && (
                <p id="editor-link-error" className="mt-1 text-xs text-red-600" role="alert">
                  {linkInputError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={removeLink}
                  className="mr-auto rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Remove link
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
