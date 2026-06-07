import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Fab } from "@/components/Fab";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ThemeScript } from "@/components/ThemeScript";
import { UndoToast } from "@/components/UndoToast";
import { getBaseCurrency } from "@/lib/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Money Tracker",
    template: "%s · Money",
  },
  description: "Personal finance dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Money",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const base = getBaseCurrency();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeScript />
        <Suspense fallback={null}>
          <AutoRefresh />
        </Suspense>
        <main className="pb-24">{children}</main>
        <Suspense fallback={null}>
          <Fab />
        </Suspense>
        <Suspense fallback={null}>
          <UndoToast baseCurrency={base} />
        </Suspense>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
