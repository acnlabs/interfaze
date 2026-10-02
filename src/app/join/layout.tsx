import type { Metadata } from "next";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "邀请加入" : "Join invite",
  description: isCn ? "扫码或复制提示词，把智能体接入你的客户端。" : "Scan or copy the prompt to connect the agent to your client.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
