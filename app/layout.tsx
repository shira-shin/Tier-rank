import "./globals.css";

import type { Metadata } from "next";
import React from "react";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Tier Rank",
  robots: process.env.VERCEL_ENV === "preview" ? "noindex, nofollow" : "index, follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
