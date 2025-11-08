"use client";

import { FormEvent, useState } from "react";

interface ProfileSettingsFormProps {
  initialData: {
    handle?: string;
    display?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    links?: { twitter?: string; github?: string; site?: string } | null;
  };
}

export default function ProfileSettingsForm({ initialData }: ProfileSettingsFormProps) {
  const [handle, setHandle] = useState(initialData.handle ?? "");
  const [display, setDisplay] = useState(initialData.display ?? "");
  const [bio, setBio] = useState(initialData.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl ?? "");
  const [twitter, setTwitter] = useState(initialData.links?.twitter ?? "");
  const [github, setGithub] = useState(initialData.links?.github ?? "");
  const [site, setSite] = useState(initialData.links?.site ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError(undefined);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          display,
          bio: bio || undefined,
          avatarUrl: avatarUrl || undefined,
          links: {
            twitter: twitter || undefined,
            github: github || undefined,
            site: site || undefined,
          },
        }),
      });
      const json = await response.json().catch(() => undefined);
      if (!response.ok) {
        if (json?.error === "handle_taken") {
          setError("このハンドルは既に使用されています。");
        } else {
          setError("保存に失敗しました。");
        }
        setStatus("error");
        return;
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (submitError) {
      console.error(submitError);
      setError("保存に失敗しました。");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">プロフィール設定</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">公開プロフィールに表示される情報を編集します。</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">@ハンドル</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="例: tier_master"
            className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            required
            minLength={2}
          />
          <span className="text-xs text-slate-500">半角英数字とアンダースコアのみ、32文字まで。</span>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">表示名</span>
          <input
            value={display}
            onChange={(event) => setDisplay(event.target.value)}
            placeholder="例: ティア太郎"
            className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-semibold">自己紹介</span>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={4}
          placeholder="好きなジャンルやスコアリングのポリシーなどを記載"
          className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-semibold">アバター画像URL</span>
        <input
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://example.com/avatar.png"
          className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">Twitter</span>
          <input
            value={twitter}
            onChange={(event) => setTwitter(event.target.value)}
            placeholder="https://x.com/username"
            className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">GitHub</span>
          <input
            value={github}
            onChange={(event) => setGithub(event.target.value)}
            placeholder="https://github.com/username"
            className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-semibold">Webサイト</span>
          <input
            value={site}
            onChange={(event) => setSite(event.target.value)}
            placeholder="https://example.com"
            className="rounded-xl border border-slate-300 bg-white/90 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 font-semibold text-white shadow-lg transition hover:from-emerald-600 hover:to-sky-600 disabled:opacity-60"
        >
          {status === "saving" ? "保存中…" : "保存する"}
        </button>
        {status === "success" && <span className="text-emerald-600">保存しました！</span>}
        {status === "error" && error && <span className="text-rose-500">{error}</span>}
      </div>
    </form>
  );
}
