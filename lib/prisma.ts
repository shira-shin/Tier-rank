import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

if (!process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_URL) {
  process.env.POSTGRES_PRISMA_URL = process.env.POSTGRES_URL;
}

if (!process.env.POSTGRES_URL_NON_POOLING && process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL_NON_POOLING = process.env.POSTGRES_URL;
}

if (!process.env.POSTGRES_PRISMA_URL) {
  throw new Error(
    "POSTGRES_PRISMA_URL (or POSTGRES_URL as fallback) must be configured to initialise PrismaClient.",
  );
}

const prismaClientSingleton = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/**
 * PrismaClient を利用する Server Component / Route Handler 側では、
 * Edge runtime へデプロイされないように `export const runtime = "nodejs";`
 * を明示し、必要に応じて `dynamic = "force-dynamic"` や `revalidate = 0`
 * を組み合わせてください。
 */
export default prisma;
