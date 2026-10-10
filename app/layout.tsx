import type { Metadata } from "next";
import { Suspense } from "react";
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
  title: "Mercantile Marine Academy — AI Assistant",
  description:
    "Meet MMA Assistant, Mercantile Marine Academy’s voice information assistant. Speak naturally in English, Bengali, or Hindi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Extensions may inject attributes on body before React hydrates.
          Suppression is limited to this element, not descendant components. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Suspense
          fallback={<div className="loading-state">Loading MMA Assistant…</div>}
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}
