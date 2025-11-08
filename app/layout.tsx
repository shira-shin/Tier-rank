import "./globals.css";

import type { Metadata } from "next";
import React from "react";
import AuthProvider from "@/components/AuthProvider";
import { Noto_Sans_JP } from "next/font/google";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tier Rank",
  robots: process.env.VERCEL_ENV === "preview" ? "noindex, nofollow" : "index, follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${notoSans.className} min-h-screen text-base`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
