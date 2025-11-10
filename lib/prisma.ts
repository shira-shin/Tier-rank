import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * PrismaClient を利用する Server Component / Route Handler 側では、
 * Edge runtime へデプロイされないように `export const runtime = "nodejs";`
 * を明示し、必要に応じて `dynamic = "force-dynamic"` や `revalidate = 0`
 * を組み合わせてください。
 */
export default prisma;
