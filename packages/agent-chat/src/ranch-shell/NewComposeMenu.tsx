"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RanchMessages } from "./i18n";
import { btnGhost, btnPrimary, colors } from "./styles";

type Props = {
  allowGroupChat: boolean;
  messages: RanchMessages;
  showCreateHosted?: boolean;
  onCreateHosted?: () => void;
  onConnectExisting: () => void;
  onDirect: () => void;
  onGroup: () => void;
};

type MenuEntry = { key: string; label: string; action: () => void };

export function NewComposeMenu({
  allowGroupChat,
  messages: t,
  showCreateHosted,
  onCreateHosted,
  onConnectExisting,
  onDirect,
  onGroup,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const entries: MenuEntry[] = [
    ...(showCreateHosted && onCreateHosted
      ? [{ key: "create", label: t.createAgentTitle, action: onCreateHosted }]
      : []),
    { key: "connect", label: t.connectExisting, action: onConnectExisting },
    { key: "direct", label: t.newDirectChat, action: onDirect },
    ...(allowGroupChat ? [{ key: "group", label: t.newGroupChat, action: onGroup }] : []),
  ];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
      return;
    }
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        style={btnPrimary}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        + {t.newChat}
      </button>
      {open ? (
        <div ref={menuRef} role="menu" style={menu} onKeyDown={onMenuKeyDown}>
          {entries.map((entry, i) => (
            <MenuItem
              key={entry.key}
              label={entry.label}
              onClick={() => pick(entry.action)}
              showDividerAbove={entry.key === "connect" && i > 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  showDividerAbove,
}: {
  label: string;
  onClick: () => void;
  showDividerAbove?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <>
      {showDividerAbove ? <div aria-hidden style={divider} /> : null}
      <button
        type="button"
        role="menuitem"
        style={{ ...item, background: hover ? colors.hover : "transparent" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={onClick}
      >
        {label}
      </button>
    </>
  );
}

const menu: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  zIndex: 40,
  minWidth: 196,
  padding: 4,
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
};

const item: CSSProperties = {
  ...btnGhost,
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};

const divider: CSSProperties = {
  height: 1,
  margin: "4px 6px",
  background: colors.border,
};
