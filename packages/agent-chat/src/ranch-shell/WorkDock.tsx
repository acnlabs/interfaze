"use client";

import { useState, type ReactNode } from "react";
import { colors } from "./styles";

export type WorkTab = {
  id: string;
  title: string;
  kind: "canvas" | "computer" | "talk" | "body";
  blockKey?: string;
};

/** Right-hand column: several named windows, one visible, plus a way to add another. */
export function WorkDock({
  tabs,
  activeId,
  overlay,
  closeLabel,
  addLabel,
  addCanvasLabel,
  computers,
  onSelect,
  onClose,
  onAddCanvas,
  onOpenComputer,
  columnCloseLabel,
  onCloseColumn,
  children,
}: {
  tabs: WorkTab[];
  activeId: string | null;
  overlay?: boolean;
  closeLabel: string;
  addLabel: string;
  addCanvasLabel: string;
  computers: { id: string; label: string; open: boolean }[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAddCanvas: () => void;
  onOpenComputer: (id: string, label: string) => void;
  columnCloseLabel: string;
  onCloseColumn: () => void;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId)?.id ?? tabs[0]?.id ?? null;

  return (
    <aside
      data-work-dock={overlay ? "overlay" : "side"}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: colors.bg,
        color: colors.text,
        borderLeft: `1px solid ${colors.border}`,
        ...(overlay
          ? {
              position: "absolute",
              inset: 0,
              zIndex: 40,
              width: "100%",
            }
          : {
              flex: "1 1 0",
              minWidth: 280,
              height: "100%",
            }),
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 8px",
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          role="tablist"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
            overflowX: "auto",
          }}
        >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <div
              key={tab.id}
              style={{
                display: "flex",
                alignItems: "center",
                maxWidth: 200,
                flexShrink: 0,
                borderRadius: 8,
                background: selected ? colors.panel : "transparent",
                border: `1px solid ${selected ? colors.border : "transparent"}`,
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                title={tab.title}
                onClick={() => onSelect(tab.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: colors.text,
                  fontSize: 13,
                  padding: "6px 4px 6px 10px",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {tab.title}
              </button>
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => onClose(tab.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: colors.muted,
                  fontSize: 14,
                  lineHeight: 1,
                  padding: "4px 8px 4px 2px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          aria-label={addLabel}
          aria-expanded={menu}
          onClick={() => setMenu((open) => !open)}
          style={{
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.text,
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
          }}
        >
          +
        </button>
        {menu ? (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 2,
              marginTop: 4,
              minWidth: 140,
              padding: 4,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onAddCanvas();
              }}
              style={menuItem}
            >
              {addCanvasLabel}
            </button>
            {computers.map((computer) => (
              <button
                key={computer.id}
                type="button"
                disabled={computer.open}
                aria-disabled={computer.open}
                onClick={() => {
                  if (computer.open) return;
                  setMenu(false);
                  onOpenComputer(computer.id, computer.label);
                }}
                style={{
                  ...menuItem,
                  opacity: computer.open ? 0.4 : 1,
                  cursor: computer.open ? "default" : "pointer",
                }}
              >
                {computer.label}
              </button>
            ))}
          </div>
        ) : null}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          aria-label={columnCloseLabel}
          title={columnCloseLabel}
          onClick={onCloseColumn}
          style={{
            flexShrink: 0,
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.text,
            borderRadius: 8,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </aside>
  );
}

const menuItem = {
  border: 0,
  background: "transparent",
  color: colors.text,
  textAlign: "left" as const,
  fontSize: 13,
  padding: "8px 10px",
  borderRadius: 6,
  cursor: "pointer",
};
