import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SENTINEL — Autonomous Infrastructure Control",
  description: "Real-time infrastructure monitoring, incident visualization, and autonomous orchestration powered by Archestra A2A.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
