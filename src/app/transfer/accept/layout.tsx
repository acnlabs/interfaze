import type { Metadata } from "next";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "接收转让" : "Accept transfer",
  description: isCn ? "接收他人转让给你的智能体。" : "Accept an agent transferred to you.",
};

export default function TransferAcceptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
