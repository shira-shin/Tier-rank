"use client";
import { useSession } from "next-auth/react";
import NavBar from "@/components/NavBar";
import ScoreForm from "@/components/ScoreForm";

export default function Page() {
  const { data: session, status } = useSession();
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {!session && status!=="loading" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
            ログインしていません。Googleでサインインすると、保存や共有などの機能を有効化できます。
          </div>
        )}
        <ScoreForm />
      </main>
    </div>
  );
}
