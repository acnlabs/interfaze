"use client";

import { useState, type CSSProperties } from "react";
import { colors } from "./styles";

/** Account lists open at this many rows. Shorter lists stay fully visible. */
export const LIST_PREVIEW_COUNT = 5;

export function fillCount(template: string, n: number): string {
  return template.split("{n}").join(String(n));
}

export function useListPreview<T>(items: readonly T[]): {
  shown: T[];
  hidden: number;
  open: boolean;
  toggle: () => void;
} {
  const [open, setOpen] = useState(false);
  const hidden = Math.max(0, items.length - LIST_PREVIEW_COUNT);
  const shown = hidden > 0 && !open ? items.slice(0, LIST_PREVIEW_COUNT) : items.slice();
  return {
    shown,
    hidden,
    open,
    toggle: () => setOpen((value) => !value),
  };
}

const foldButton: CSSProperties = {
  display: "block",
  width: "100%",
  margin: 0,
  border: 0,
  background: "transparent",
  color: colors.muted,
  fontSize: 13,
  fontWeight: 600,
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
};

export function ListFoldButton({
  hidden,
  open,
  onToggle,
  moreLabel,
  lessLabel,
}: {
  hidden: number;
  open: boolean;
  onToggle: () => void;
  moreLabel: string;
  lessLabel: string;
}) {
  if (hidden <= 0) return null;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} style={foldButton}>
      {open ? lessLabel : moreLabel}
    </button>
  );
}
