import { MarketStats } from "@/components/MarketStats";
import { PositionCard } from "@/components/PositionCard";
import { SupplyCard } from "@/components/SupplyCard";
import { BorrowCard } from "@/components/BorrowCard";

const PARAMS = [
  { label: "Max LTV",           value: "75%",  desc: "Borrow up to 75% of collateral value" },
  { label: "Liquidation at",    value: "85%",  desc: "Liquidatable when collateral hits 85% of debt" },
  { label: "Borrow APR",        value: "5%",   desc: "Fixed simple interest rate" },
  { label: "Liquidation Bonus", value: "+5%",  desc: "Bonus for liquidators" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ── Background glow ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top center emerald glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-900/15 rounded-full blur-3xl" />
        {/* Bottom left subtle glow */}
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-teal-900/10 rounded-full blur-3xl" />
        {/* Top right subtle glow */}
        <div className="absolute top-1/3 right-0 w-[300px] h-[300px] bg-blue-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-10 space-y-8">

        {/* ── Hero section ──────────────────────────────────────────────── */}
        <div className="text-center space-y-4 fade-in">
          {/* Network badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Base Sepolia · Collateralized Lending
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none">
            Lend
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              X
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
            Supply WETH as collateral. Borrow USDC against it.
            Manage your health factor. Stay solvent.
          </p>
        </div>

        {/* ── Protocol parameters ────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3 fade-in">
          {PARAMS.map(({ label, value, desc }) => (
            <div
              key={label}
              title={desc}
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-center hover:bg-white/[0.06] hover:border-white/20 transition-all duration-200 cursor-help"
            >
              <p className="text-white font-bold text-base">{value}</p>
              <p className="text-slate-500 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Market statistics ──────────────────────────────────────────── */}
        <div className="slide-up">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Market Overview
            </h2>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <MarketStats />
        </div>

        {/* ── Main app layout ────────────────────────────────────────────── */}
        <div className="slide-up">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Protocol
            </h2>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Position overview (left) */}
            <PositionCard />

            {/* Supply/Withdraw (center) */}
            <SupplyCard />

            {/* Borrow/Repay (right) */}
            <BorrowCard />
          </div>
        </div>

        {/* ── Educational footer ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            How LendX Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-500">
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">1. Supply Collateral</p>
              <p>Deposit WETH to unlock borrowing power. 1 WETH at $2000 = $1500 max borrow (75% LTV).</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">2. Borrow USDC</p>
              <p>Borrow up to 75% of your collateral value. Debt accrues at 5% APR simple interest.</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">3. Monitor Health</p>
              <p>Health Factor = (collateral × 85%) / debt. Keep HF above 1.0 or face liquidation.</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">4. Repay & Withdraw</p>
              <p>Repay USDC debt to improve health factor. Withdraw collateral when debt is cleared.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-700 pb-6">
          LendX · Educational DeFi Protocol · Base Sepolia Testnet · Not for production use
        </div>
      </div>
    </div>
  );
}
