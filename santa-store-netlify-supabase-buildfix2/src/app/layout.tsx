import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Santa Store | Holiday Digital Goods", description: "Premium digital products, delivered securely." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
