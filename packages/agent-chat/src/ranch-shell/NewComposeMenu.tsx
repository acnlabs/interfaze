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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        style={btnPrimary}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        + {t.newChat}
      </button>
      {open ? (
        <div role="menu" style={menu}>
          {showCreateHosted && onCreateHosted ? (
            <>
              <button type="button" role="menuitem" style={item} onClick={() => pick(onCreateHosted)}>
                {t.createAgentTitle}
              </button>
              <div aria-hidden style={divider} />
            </>
          ) : null}
          <button type="button" role="menuitem" style={item} onClick={() => pick(onConnectExisting)}>
            {t.connectExisting}
          </button>
          <button type="button" role="menuitem" style={item} onClick={() => pick(onDirect)}>
            {t.newDirectChat}
          </button>
          {allowGroupChat ? (
            <button type="button" role="menuitem" style={item} onClick={() => pick(onGroup)}>
              {t.newGroupChat}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
