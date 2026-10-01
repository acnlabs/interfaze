"use client";

import { useRef } from "react";
import { btnGhost, colors } from "./styles";
import { useModalA11y } from "./useModalA11y";

/** Shell-level confirm dialog: Escape / backdrop close, focus trap, focus restore. */
export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useModalA11y({
    open: true,
    onClose: () => {
      if (!busy) onCancel();
    },
    containerRef: panelRef,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          width: "min(340px, 100%)",
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 14,
            lineHeight: 1.5,
            color: colors.text,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={btnGhost} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            style={{
              ...btnGhost,
              background: "rgba(248,113,113,0.15)",
              borderColor: "rgba(248,113,113,0.45)",
              color: colors.danger,
              fontWeight: 600,
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
