import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import ProfileSettingsForm from "@/components/ProfileSettingsForm";

export default async function SettingsProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-100 py-16">
      <div className="mx-auto max-w-4xl px-4">
        <ProfileSettingsForm
          initialData={{
            handle: profile?.handle ?? "",
            display: profile?.display ?? session.user.name ?? "",
            bio: profile?.bio ?? "",
            avatarUrl: profile?.avatarUrl ?? session.user.image ?? "",
            links: (profile?.links as { twitter?: string; github?: string; site?: string } | null) ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
