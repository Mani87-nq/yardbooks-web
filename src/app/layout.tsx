import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PostHogProvider } from "@/components/PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "YaadBooks — Jamaica's Complete Business Management Solution",
  description: "Invoicing, POS, inventory, payroll, GCT filing, and more — all in one place. Built for Jamaican businesses.",
  keywords: ["accounting software", "Jamaica", "invoicing", "POS", "payroll", "GCT", "business management"],
  authors: [{ name: "YaadBooks" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YaadBooks",
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
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
