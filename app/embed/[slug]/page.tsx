import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import ResultTabs from "@/components/ResultTabs";
import type { AgentResult, ItemInput, MetricInput } from "@/lib/types";

export const revalidate = 0;

export default async function EmbedRankingPage({ params }: { params: { slug: string } }) {
  const ranking = await prisma.ranking.findUnique({ where: { slug: params.slug } });
  if (!ranking || ranking.visibility === "PRIVATE") {
    notFound();
  }

  return (
    <div className="min-h-full bg-slate-900/90 p-4 text-white">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-lg">
        <h1 className="text-lg font-semibold">{ranking.title}</h1>
        <div className="mt-3 min-h-[420px]">
          <ResultTabs
            data={ranking.resultJson as AgentResult}
            tab="tier"
            items={ranking.itemsJson as ItemInput[]}
            metrics={ranking.metricsJson as MetricInput[]}
          />
        </div>
      </div>
    </div>
  );
}
