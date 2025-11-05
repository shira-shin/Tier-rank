export const metadata = {
  title: "Tier Rank",
  description: "Minimal scaffold",
  robots: process.env.VERCEL_ENV === "preview" ? "noindex, nofollow" : "index, follow"
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>{children}</body>
    </html>
  );
}
