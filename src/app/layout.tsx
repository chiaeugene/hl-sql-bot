import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuroraScene from "@/components/AuroraScene";
import PoweredBy from "@/components/PoweredBy";

// UI typeface — modern, friendly, professional.
const sans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Monospace — item codes, quantities, prices (tabular figures).
const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hock Lee · Invoice → SQL",
  description: "Scan supplier invoices and generate SQL-ready item codes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuroraScene />
        <PoweredBy />
        {children}
      </body>
    </html>
  );
}
