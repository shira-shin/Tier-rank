const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export function buildRankingUrl(slug: string) {
  if (APP_URL) return `${APP_URL}/r/${slug}`;
  return `/r/${slug}`;
}

export function buildShareUrls(slug: string, title: string) {
  const encodedUrl = encodeURIComponent(buildRankingUrl(slug));
  const encodedTitle = encodeURIComponent(title);
  return {
    x: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
    copy: buildRankingUrl(slug),
  };
}
