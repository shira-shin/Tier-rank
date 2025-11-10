import prisma from "@/lib/prisma";

export async function getDefaultProject() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (project) {
    return project;
  }

  const demo = await prisma.project.findUnique({ where: { slug: "demo" } });
  return demo ?? null;
}
