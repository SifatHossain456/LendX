"use client";

import { useProtocolStats } from "@/hooks/useLendX";
import { fmtUsdc, utilizationPct } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  sublabel?: string;
}

function StatCard({ label, value, color, sublabel }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-white/20 transition-all duration-200">
      <p className={`font-bold text-xl tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-slate-600 mt-0.5">{sublabel}</p>}
    </div>
  );
}

/**
 * MarketStats — Protocol-level dashboard statistics
 *
 * Displays 6 key metrics in a responsive grid:
 *   - ETH Price (from oracle)
 *   - Total Supplied (USDC liquidity seeded by deployer)
 *   - Total Borrowed (outstanding USDC debt)
 *   - Utilization % (borrowed / supplied)
 *   - Supply APR (always 0% — simplified protocol, no supplier yield)
 *   - Borrow APR (fixed 5%)
 */
export function MarketStats() {
  const { data: stats, isLoading } = useProtocolStats();

  const totalBorrowed = stats?.[1] ?? 0n;
  const totalSupplied = stats?.[2] ?? 0n;
  const utilizBps     = stats?.[3] ?? 0n;
  const ethPrice      = stats?.[4] ?? 0n;

  const utilPct = utilizationPct(utilizBps);
  const ethUsd  = ethPrice > 0n
    ? `$${(Number(ethPrice) / 1e8).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : "—";

  const utilizColor =
    utilPct > 80 ? "text-red-400"
    : utilPct > 60 ? "text-yellow-400"
    : "text-emerald-400";

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-pulse"
          >
            <div className="h-7 bg-white/10 rounded mb-2 w-20" />
            <div className="h-3 bg-white/5 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard
        label="ETH / USD"
        value={ethUsd}
        color="text-white"
        sublabel="MockOracle price"
      />
      <StatCard
        label="Total Supplied"
        value={`$${fmtUsdc(totalSupplied)}`}
        color="text-emerald-400"
        sublabel="Available to borrow"
      />
      <StatCard
        label="Total Borrowed"
        value={`$${fmtUsdc(totalBorrowed)}`}
        color="text-blue-400"
        sublabel="Outstanding USDC debt"
      />
      <StatCard
        label="Utilization"
        value={`${utilPct.toFixed(1)}%`}
        color={utilizColor}
        sublabel={utilPct > 80 ? "High — rates rising" : "Normal"}
      />
      <StatCard
        label="Supply APR"
        value="0.00%"
        color="text-slate-400"
        sublabel="No supplier yield (simplified)"
      />
      <StatCard
        label="Borrow APR"
        value="5.00%"
        color="text-orange-400"
        sublabel="Fixed simple interest"
      />
    </div>
  );
}
