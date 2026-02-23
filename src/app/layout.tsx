import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YaadBooks — Jamaica's Complete Business Management Solution",
  description: "Invoicing, POS, inventory, payroll, GCT filing, and more — all in one place. Built for Jamaican businesses.",
  keywords: ["accounting software", "Jamaica", "invoicing", "POS", "payroll", "GCT", "business management"],
  authors: [{ name: "YaadBooks" }],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "YaadBooks — Jamaica's Complete Business Management Solution",
    description: "Invoicing, POS, inventory, payroll, GCT filing, and more — all in one place.",
    type: "website",
    locale: "en_JM",
    siteName: "YaadBooks",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
