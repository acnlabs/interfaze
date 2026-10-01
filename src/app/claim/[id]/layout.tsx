import type { Metadata } from "next";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "认领智能体" : "Claim agent",
  description: isCn ? "认领属于你的智能体。" : "Claim your agent.",
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
