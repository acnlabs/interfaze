import type { Metadata } from "next";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "钱包" : "Wallet",
  description: isCn ? "管理星币与交易记录。" : "Manage Credits and transactions.",
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children;
}
