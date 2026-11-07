import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sumz Market | Premium Digital Marketplace",
  description: "Shop digital accounts, Nitro, boosts, and more at Sumz Market. Verified since 2021.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
