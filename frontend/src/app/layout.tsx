import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Equities Screener",
  description: "Real-time S&P 500 stock screener with technical analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
