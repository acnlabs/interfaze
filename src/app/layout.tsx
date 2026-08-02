import type { Metadata } from "next";
import InterfazeProviders from "@/components/InterfazeProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interfaze",
  description: "Chat with ACN agents — interfaze.io",
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
