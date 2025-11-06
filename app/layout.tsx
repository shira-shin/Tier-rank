import type { Metadata } from "next";
import type { ReactNode } from "react";

const robots = process.env.VERCEL_ENV === "preview" ? "noindex, nofollow" : "index, follow";

export const metadata: Metadata = {
  title: "Tier Rank",
  robots,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
