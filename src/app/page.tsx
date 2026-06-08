import { MarketStats } from "@/components/MarketStats";
import { PositionCard } from "@/components/PositionCard";
import { SupplyCard } from "@/components/SupplyCard";
import { BorrowCard } from "@/components/BorrowCard";

const RISK_PARAMS = [
  { value: "75%",  label: "Max LTV",         desc: "Borrow up to 75% of collateral value" },
  { value: "85%",  label: "Liq. Threshold",  desc: "Liquidated when LTV exceeds 85%" },
  { value: "5%",   label: "Borrow APR",      desc: "Fixed simple interest rate" },
  { value: "+5%",  label: "Liq. Bonus",      desc: "Bonus reward for liquidators" },
];

const MECHANICS = [
  {
    n: "01",
    title: "Supply Collateral",
    body: "Deposit WETH to unlock borrowing capacity. 1 WETH at $2,000 = $1,500 max borrow at 75% LTV.",
  },
  {
    n: "02",
    title: "Borrow USDC",
    body: "Draw up to 75% of your collateral value. Interest accrues at 5% APR simple rate.",
  },
  {
    n: "03",
    title: "Monitor Health Factor",
    body: "HF = (collateral × 85%) / debt. Keep above 1.0 at all times to avoid liquidation.",
  },
  {
    n: "04",
    title: "Repay & Withdraw",
    body: "Clear your debt incrementally or all at once. Collateral unlocks as health factor improves.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-emerald-950/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-teal-950/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-0 w-[300px] h-[300px] bg-emerald-950/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-14 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-6 fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/60 text-emerald-300 text-xs font-semibold tracking-widest uppercase">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Live on Base Sepolia
          </div>

          <h1 className="text-6xl sm:text-7xl font-black text-white tracking-tight leading-none">
            Supply.{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Borrow.
            </span>
            <br />
            Earn.
          </h1>

          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Deposit WETH as collateral, borrow USDC against it, and manage
            your position health in real time.
          </p>
        </div>

        {/* Risk Parameters */}
        <div className="flex flex-wrap justify-center gap-3 fade-in">
          {RISK_PARAMS.map(({ value, label, desc }) => (
            <div
              key={label}
              title={desc}
              className="px-6 py-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] text-center hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all duration-200 cursor-help min-w-[110px]"
            >
              <p className="text-white font-extrabold text-2xl">{value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Market Overview */}
        <div className="slide-up">
          <SectionHeader title="Markets" />
          <MarketStats />
        </div>

        {/* Protocol */}
        <div className="slide-up">
          <SectionHeader title="Protocol" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <PositionCard />
            <SupplyCard />
            <BorrowCard />
          </div>
        </div>

        {/* Protocol Mechanics */}
        <div className="slide-up rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-7">
            Protocol Mechanics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {MECHANICS.map(({ n, title, body }) => (
              <div key={n} className="space-y-2">
                <p className="text-emerald-600/50 font-black text-4xl font-mono leading-none">{n}</p>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-800 pb-4">
          LendX · Collateralized Lending Protocol · Base Sepolia
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] whitespace-nowrap">
        {title}
      </h2>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}
