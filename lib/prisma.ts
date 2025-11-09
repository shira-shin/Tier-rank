import { PrismaClient } from "@prisma/client";

const g = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}

export default prisma;
