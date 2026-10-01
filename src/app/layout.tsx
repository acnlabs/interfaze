import type { Metadata } from "next";
import InterfazeProviders from "@/components/InterfazeProviders";
import "./globals.css";

const isCn = (process.env.NEXT_PUBLIC_REGION || "").trim().toLowerCase() === "cn";

export const metadata: Metadata = {
  title: {
    default: isCn ? "界面" : "Interfaze",
    template: isCn ? "%s · 界面" : "%s · Interfaze",
  },
  description: isCn
    ? "与智能体对话协作 — interfaze.acnlabs.cn"
    : "Chat with agents you own or were invited to — interfaze.io",
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
