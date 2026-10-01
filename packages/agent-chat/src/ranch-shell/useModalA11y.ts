"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility for shell dialogs:
 * - Escape invokes onClose (unless closeOnEscape is false)
 * - Focus moves into the dialog on open and returns to the trigger on close
 * - Tab / Shift+Tab cycle within the dialog (focus trap)
 *
 * Attach `containerRef` to the dialog element. Give the container
 * `tabIndex={-1}` so it can receive focus when it has no focusable child.
 * iframes are deliberately excluded from the trap: once focus crosses into
 * the embedded document, parent keydown handlers no longer fire and the
 * trap breaks.
 */
export function useModalA11y({
  open,
  onClose,
  containerRef,
  closeOnEscape = true,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
  /** Element to focus on open instead of the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0,
      );

    const preferred = initialFocusRef?.current;
    if (preferred && container.contains(preferred)) {
      preferred.focus();
    } else {
      const first = focusables()[0];
      if (first) first.focus();
      else container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!closeOnEscapeRef.current) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        }
      } else if (idx === -1 || idx === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };

    // Capture phase so the dialog wins over shell-level key handlers.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open, containerRef, initialFocusRef]);
}
