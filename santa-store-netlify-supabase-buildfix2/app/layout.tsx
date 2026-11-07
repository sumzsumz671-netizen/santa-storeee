import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata={title:"Santa Store | Sumz Market",description:"Holiday deals from Sumz Market"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}