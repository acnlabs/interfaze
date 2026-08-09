import type { Metadata } from "next";
import InterfazeProviders from "@/components/InterfazeProviders";
import "./globals.css";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: isCn ? "界面" : "Interfaze",
  description: isCn
    ? "与 ACN 智能体对话协作 — interfaze.acnlabs.cn"
    : "Chat with ACN agents — interfaze.io",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={isCn ? "zh-CN" : "en"}>
      <body>
        <InterfazeProviders>{children}</InterfazeProviders>
      </body>
    </html>
  );
}
