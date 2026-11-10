import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sumz Store | Digital Products",
  description: "Discover digital products and manage purchases from your Sumz Store account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
