"use client";

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { inputStyle } from "./styles";

const COMPOSER_LINE_PX = 20;
const COMPOSER_FIELD_PAD_PX = 8;
const COMPOSER_MAX_LINES = 8;

export function fitComposerField(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  const max = COMPOSER_MAX_LINES * COMPOSER_LINE_PX + COMPOSER_FIELD_PAD_PX;
  const next = Math.min(Math.max(el.scrollHeight, COMPOSER_LINE_PX + COMPOSER_FIELD_PAD_PX), max);
  el.style.height = `${next}px`;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

/** The conversation composer's text field: same class, sizing, and auto-grow. */
export const ComposerTextField = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { style?: CSSProperties }
>(function ComposerTextField({ className, onChange, rows, style, value, ...rest }, ref) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    fitComposerField(localRef.current);
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={(node) => {
        localRef.current = node;
        assignRef(ref, node);
      }}
      rows={rows ?? 1}
      value={value}
      className={["ranch-composer-field", "ranch-thin-scroll", className].filter(Boolean).join(" ")}
      onChange={(e) => {
        onChange?.(e);
        fitComposerField(e.currentTarget);
      }}
      style={{
        ...inputStyle,
        resize: "none",
        border: "none",
        background: "transparent",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        padding: "4px 4px",
        lineHeight: `${COMPOSER_LINE_PX}px`,
        overflowY: "auto",
        outline: "none",
        fontFamily: "inherit",
        ...style,
      }}
    />
  );
});
