import NavBar from "@/components/NavBar";

const podium = [
  {
    rank: 2,
    title: "LumiWorks",
    score: "93%",
    tagline: "知的でしなやかな意思決定",
    description:
      "企業横断のデータ統合によって、戦略レベルでの示唆を即日提供。クラウド導入やAI連携が柔軟で、経営陣が求める透明性を確保しています。",
    strengths: "グローバル連携、透明性、迅速なサポート",
    reason:
      "旧来システムとの親和性が高く、導入リードタイムが短い点が高く評価されました。",
    color: "from-slate-900 to-slate-800",
    metal: "text-slate-100",
    accent: "border-slate-600",
  },
  {
    rank: 1,
    title: "Aurelius Dynamics",
    score: "98%",
    tagline: "圧倒的安定性と成長ポテンシャル",
    description:
      "マルチモーダルAIコアを中心に、拡張性の高いセキュアネットワークを搭載。金融・製造・医療を跨ぐユースケースで平均ROI 180%を記録しています。",
    strengths: "堅牢なセキュリティ、独自AIファブリック、世界規模の導入実績",
    reason:
      "最適化アルゴリズムと自律型オペレーションにより、TCOを劇的に削減。特に24/7の自動復旧能力が群を抜いています。",
    color: "from-yellow-500 via-amber-400 to-yellow-200",
    metal: "text-slate-900",
    accent: "border-amber-200",
  },
  {
    rank: 3,
    title: "Brontech Forge",
    score: "90%",
    tagline: "現場を支えるタフな実装力",
    description:
      "製造・物流領域でのフィジカルAIを得意とし、強靭なハードウェアとMLスタックを一体提供。DX人材が少ない現場でも運用できる導線を備えています。",
    strengths: "耐環境性、ハンズオン導入、実地での改善サイクル",
    reason:
      "高コストなハードウェアを最適化し、稼働率を常時95%以上に維持できる点が評価されました。",
    color: "from-orange-900 via-amber-700 to-yellow-600",
    metal: "text-amber-100",
    accent: "border-amber-600",
  },
];

const tiers = [
  {
    label: "S",
    description: "業界を牽引し基準を再定義する絶対的リーダー",
    color: "bg-gradient-to-br from-rose-500 via-red-500 to-orange-400",
    companies: [
      {
        name: "Aurelius Dynamics",
        detail: "グローバル展開済み、24/7自律オペレーション",
      },
      {
        name: "LumiWorks",
        detail: "マルチリージョンAIハブと即時分析",
      },
    ],
  },
  {
    label: "A",
    description: "高速成長中のコアプレイヤー",
    color: "bg-gradient-to-br from-orange-400 to-amber-300",
    companies: [
      {
        name: "Brontech Forge",
        detail: "産業アプリに最適化されたMLライン",
      },
      {
        name: "Quantum Weave",
        detail: "SaaSとのAPI連携が豊富なデータOS",
      },
      {
        name: "HelioPulse",
        detail: "低遅延推論クラスタで人気",
      },
    ],
  },
  {
    label: "B",
    description: "特定領域に強い実力派",
    color: "bg-gradient-to-br from-emerald-500 to-lime-400",
    companies: [
      {
        name: "Synapse Loom",
        detail: "ローカルガバナンスに強い",
      },
      {
        name: "Arcadia Grid",
        detail: "スマートシティ向けの自動制御",
      },
    ],
  },
];

const logoColors = [
  "bg-white/90 text-slate-900",
  "bg-slate-900/80 text-amber-100",
  "bg-emerald-200 text-emerald-900",
  "bg-amber-900 text-amber-100",
];

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <NavBar />
      <main className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10 sm:px-8">
        <section className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Top 3 Podium
            </p>
            <h1 className="text-3xl font-black sm:text-4xl">シングルカラム・フルワイドランキング</h1>
            <p className="text-base text-slate-200">
              オリンピックの表彰台のようなヒエラルキーで、市場を席巻するトッププレイヤーを一目で把握。各社の評価理由や主要スコアも凝縮して掲載しています。
            </p>
          </header>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            {podium.map((company, index) => (
              <article
                key={company.title}
                className={`relative flex flex-1 flex-col gap-4 rounded-3xl border ${company.accent} bg-gradient-to-br ${company.color} p-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${
                  company.rank === 1 ? "md:scale-110" : "md:translate-y-3"
                }`}
                style={{ zIndex: podium.length - index }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold ${
                        logoColors[index % logoColors.length]
                      }`}
                    >
                      {company.title
                        .split(" ")
                        .map((word) => word[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/70">Rank {company.rank}</p>
                      <h2 className="text-2xl font-extrabold text-white">
                        {company.title}
                      </h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/70">Score</p>
                    <p className="text-3xl font-black text-white">{company.score}</p>
                  </div>
                </div>
                <p className={`text-lg font-semibold ${company.metal}`}>
                  {company.tagline}
                </p>
                <div className="space-y-2 text-sm leading-relaxed text-white/90">
                  <p>
                    <span className="font-semibold text-white">評価の理由：</span>
                    {company.reason}
                  </p>
                  <p>
                    <span className="font-semibold text-white">強み：</span>
                    {company.strengths}
                  </p>
                  <p>
                    <span className="font-semibold text-white">主要スコア：</span>
                    {company.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
              The "Real" Tier Matrix
            </p>
            <h2 className="text-3xl font-black sm:text-4xl">Tierリストで即座に位置づけを把握</h2>
            <p className="text-base text-slate-200">
              TierMaker文化をモダンに再設計したリスト。各行のラベルとカードの密な配置により、企業の立ち位置が瞬時に把握できます。
            </p>
          </header>
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div
                key={tier.label}
                className="flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-inner shadow-black/40 sm:flex-row"
              >
                <div className="flex w-full items-center justify-center p-6 sm:w-44 sm:flex-col sm:justify-between"
                  style={{ minHeight: "120px" }}
                >
                  <div className={`flex h-24 w-24 items-center justify-center rounded-2xl text-4xl font-black text-white ${tier.color}`}>
                    {tier.label}
                  </div>
                  <p className="mt-4 text-center text-xs font-semibold uppercase tracking-widest text-white/70">
                    {tier.description}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap gap-4 border-t border-white/10 p-6 sm:border-l sm:border-t-0">
                  {tier.companies.map((company, idx) => (
                    <div
                      key={company.name}
                      className="flex min-w-[220px] flex-1 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold ${
                              logoColors[(idx + tiers.indexOf(tier)) % logoColors.length]
                            }`}
                          >
                            {company.name
                              .split(" ")
                              .map((word) => word[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {company.name}
                            </p>
                            <p className="text-xs text-white/60">{company.detail}</p>
                          </div>
                        </div>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/10">
                        <div className="h-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${80 - idx * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
