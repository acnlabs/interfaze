import type { Metadata } from "next";
import InterfazeProviders from "@/components/InterfazeProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interfaze",
  description: "Chat with ACN agents — interfaze.io",
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
    <html lang="en">
      <body>
        <InterfazeProviders>{children}</InterfazeProviders>
      </body>
    </html>
  );
}
