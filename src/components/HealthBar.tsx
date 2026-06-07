"use client";

import { fmtHF, hfColor, hfPct } from "@/lib/utils";

interface HealthBarProps {
  hf: bigint;
}

/**
 * HealthBar — Aave-style health factor visualization
 *
 * Health factor thresholds:
 *   > 2.0 (100% bar) → "Healthy" (green)
 *   1.2 – 2.0       → "Caution" (yellow)
 *   1.0 – 1.2       → "At Risk" (orange)
 *   < 1.0            → "Liquidatable" (red)
 *
 * type(uint256).max → no debt → "No Debt" + full green bar
 */
export function HealthBar({ hf }: HealthBarProps) {
  const pct   = hfPct(hf);
  const color = hfColor(hf);
  const value = fmtHF(hf);

  const isInfinite =
    hf === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  // Bar fill color
  const barColor =
    pct >= 75 ? "bg-gradient-to-r from-emerald-500 to-green-400"
    : pct >= 60 ? "bg-gradient-to-r from-yellow-500 to-amber-400"
    : pct >= 50 ? "bg-gradient-to-r from-orange-500 to-amber-500"
    : "bg-gradient-to-r from-red-600 to-red-400";

  // Status label
  const status =
    isInfinite ? "No Debt"
    : pct >= 75 ? "Healthy"
    : pct >= 60 ? "Caution"
    : pct >= 50 ? "At Risk"
    : "Liquidatable";

  // Status badge background
  const badgeBg =
    pct >= 75 ? "bg-green-500/10 text-green-400 border-green-500/20"
    : pct >= 60 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    : pct >= 50 ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
    : "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <div className="space-y-2.5">
      {/* Header row: label + value + badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Health Factor
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-black tabular-nums ${color}`}>
            {value}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeBg}`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-white/8 rounded-full overflow-hidden ring-1 ring-white/10">
        {/* Background track */}
        <div className="absolute inset-0 rounded-full bg-white/5" />

        {/* Filled portion */}
        <div
          className={`relative h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        >
          {/* Shimmer effect */}
          {pct > 10 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
          )}
        </div>

        {/* Liquidation threshold marker at 50% (= 1.0 HF) */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/30"
          style={{ left: "50%" }}
          title="Liquidation threshold (HF = 1.0)"
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-slate-600 font-mono">
        <span>0</span>
        <span className="text-slate-500">1.0 ← liquidation</span>
        <span>2.0+</span>
      </div>

      {/* Warning banner when at risk */}
      {!isInfinite && pct < 60 && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-medium ${
            pct < 50
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-orange-500/30 bg-orange-500/10 text-orange-400"
          }`}
        >
          {pct < 50
            ? "Your position is liquidatable! Repay debt or add collateral immediately."
            : "Your position is at risk. Consider repaying debt or adding more collateral."}
        </div>
      )}
    </div>
  );
}
