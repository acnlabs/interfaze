import type { Metadata } from "next";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "订阅" : "Subscribe",
  description: isCn ? "选择方案并订阅。" : "Pick a plan and subscribe.",
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
