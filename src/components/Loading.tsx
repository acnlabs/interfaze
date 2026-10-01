"use client";

import type { CSSProperties } from "react";

/** Shared loading indicator: spinner + optional label, announced to screen readers. */
export default function Loading({
  label,
  style,
  block = false,
}: {
  label?: string;
  style?: CSSProperties;
  /** Fill parent width (flex) instead of inline-flex; center via style.justifyContent. */
  block?: boolean;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: block ? "flex" : "inline-flex",
        alignItems: "center",
        gap: 10,
        ...style,
      }}
    >
      <style>{`@keyframes ifz-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid currentColor",
          borderTopColor: "transparent",
          opacity: 0.9,
          animation: "ifz-spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
