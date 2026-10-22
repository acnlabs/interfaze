import type { CSSProperties } from "react";
import { parseMessageMarkdown, type MarkdownInline } from "./messageMarkdown";

const paragraphStyle: CSSProperties = { margin: 0 };
const listStyle: CSSProperties = { margin: "6px 0", paddingLeft: "1.2em" };
const codeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: "0.92em",
  background: "rgba(255,255,255,0.08)",
  borderRadius: 4,
  padding: "0 4px",
};
const tableWrapStyle: CSSProperties = { overflowX: "auto", maxWidth: "100%", margin: "6px 0" };
const tableStyle: CSSProperties = { borderCollapse: "collapse", fontSize: "0.92em" };
const cellStyle: CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  padding: "4px 8px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

function InlineRuns({ inlines }: { inlines: MarkdownInline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.type === "break") return <br key={index} />;
        if (inline.type === "strong") return <strong key={index}>{inline.text}</strong>;
        if (inline.type === "code") {
          return (
            <code key={index} style={codeStyle}>
              {inline.text}
            </code>
          );
        }
        return <span key={index}>{inline.text}</span>;
      })}
    </>
  );
}

export function MessageBody({ text }: { text: string }) {
  const blocks = parseMessageMarkdown(text);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} style={paragraphStyle}>
              <InlineRuns inlines={block.inlines} />
            </p>
          );
        }
        if (block.type === "heading") {
          return (
            <p
              key={index}
              role="heading"
              aria-level={block.level}
              style={{ ...paragraphStyle, fontWeight: 700, fontSize: block.level <= 2 ? "1.08em" : "1em" }}
            >
              <InlineRuns inlines={block.inlines} />
            </p>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index} style={listStyle}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineRuns inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} style={{ ...codeStyle, margin: "6px 0", padding: 8, whiteSpace: "pre-wrap" }}>
              {block.text}
            </pre>
          );
        }
        if (block.type === "gap") {
          return <div key={index} aria-hidden style={{ height: "1.5em" }} />;
        }
        const width = Math.max(block.header.length, ...block.rows.map((row) => row.length), 1);
        const cells = (row: string[]) => Array.from({ length: width }, (_, cell) => row[cell] ?? "");
        return (
          <div key={index} style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {cells(block.header).map((cell, cellIndex) => (
                    <th key={cellIndex} style={cellStyle}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              {block.rows.length > 0 ? (
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {cells(row).map((cell, cellIndex) => (
                        <td key={cellIndex} style={cellStyle}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : null}
            </table>
          </div>
        );
      })}
    </>
  );
}
