"use client";

import { useAccount } from "wagmi";
import {
  useUserData,
  useTokenBalances,
  useFaucetWeth,
  useFaucetUsdc,
  useProtocolStats,
} from "@/hooks/useLendX";
import { HealthBar } from "./HealthBar";
import { fmtWeth, fmtUsdc } from "@/lib/utils";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";

/**
 * PositionCard — User's current lending position overview
 *
 * Sections:
 *   1. Health factor bar (with visual status)
 *   2. Collateral supplied (WETH amount + estimated USD value)
 *   3. Outstanding debt (USDC + accrued interest breakdown)
 *   4. Available to borrow (remaining capacity)
 *   5. Wallet balances + faucet buttons
 */
export function PositionCard() {
  const { isConnected } = useAccount();
  const { data: userData, refetch: refetchUser } = useUserData();
  const { data: stats } = useProtocolStats();
  const balances = useTokenBalances();
  const fweth    = useFaucetWeth();
  const fusdc    = useFaucetUsdc();

  const collateral = userData?.[0] ?? 0n;
  const debt       = userData?.[1] ?? 0n;
  const maxBorrow  = userData?.[2] ?? 0n;
  const hf         = userData?.[3] ?? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  const interest   = userData?.[4] ?? 0n;
  const principal  = debt - interest;

  // Compute collateral USD value from ETH price
  const ethPrice   = stats?.[4] ?? 0n;
  const collateralUsd = ethPrice > 0n
    ? (Number(formatUnits(collateral, 18)) * Number(ethPrice) / 1e8).toFixed(2)
    : null;

  // Available to borrow = max borrow capacity - current debt
  const available = maxBorrow > debt ? maxBorrow - debt : 0n;

  const handleFaucetWeth = async () => {
    try { await fweth.claim(); balances.refetch(); refetchUser(); } catch {}
  };
  const handleFaucetUsdc = async () => {
    try { await fusdc.claim(); balances.refetch(); } catch {}
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col items-center justify-center gap-4 min-h-[280px]">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1">Connect Your Wallet</p>
          <p className="text-slate-400 text-sm">Connect to start lending on LendX</p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Your Position
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500">Live</span>
        </div>
      </div>

      {/* Health factor visualization */}
      <HealthBar hf={hf} />

      {/* Collateral + Debt cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Collateral supplied */}
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 space-y-1">
          <p className="text-emerald-400 font-bold text-lg tabular-nums">
            {fmtWeth(collateral)} <span className="text-sm font-medium">WETH</span>
          </p>
          {collateralUsd && (
            <p className="text-slate-400 text-xs">≈ ${parseFloat(collateralUsd).toLocaleString()} USD</p>
          )}
          <p className="text-slate-500 text-xs">Collateral Supplied</p>
        </div>

        {/* Debt outstanding */}
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3.5 space-y-1">
          <p className="text-red-400 font-bold text-lg tabular-nums">
            ${fmtUsdc(debt)}
          </p>
          {interest > 0n && (
            <p className="text-orange-400 text-xs">+${fmtUsdc(interest)} interest</p>
          )}
          <p className="text-slate-500 text-xs">Outstanding Debt</p>
        </div>
      </div>

      {/* Available to borrow */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Available to Borrow</p>
          <p className="text-white font-bold tabular-nums">
            ${fmtUsdc(available)} <span className="text-slate-400 font-normal text-xs">USDC</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs mb-0.5">Max LTV</p>
          <p className="text-slate-300 font-semibold">75%</p>
        </div>
      </div>

      {/* Wallet balances + faucets */}
      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Wallet
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* WETH balance + faucet */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-4 h-4 rounded-full bg-blue-400/20 flex items-center justify-center">
                <span className="text-xs">Ξ</span>
              </div>
              <span className="text-white font-medium text-sm">
                {fmtWeth(balances.wethBal)} WETH
              </span>
            </div>
            {!balances.wethFaucetUsed ? (
              <button
                onClick={handleFaucetWeth}
                disabled={fweth.isPending || fweth.isConfirming}
                className="w-full text-xs py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {fweth.isPending || fweth.isConfirming ? "Claiming..." : "Get 1 WETH"}
              </button>
            ) : (
              <p className="text-xs text-slate-600 text-center py-1">Faucet used</p>
            )}
          </div>

          {/* USDC balance + faucet */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-4 h-4 rounded-full bg-green-400/20 flex items-center justify-center">
                <span className="text-xs">$</span>
              </div>
              <span className="text-white font-medium text-sm">
                ${fmtUsdc(balances.usdcBal)}
              </span>
            </div>
            {!balances.usdcFaucetUsed ? (
              <button
                onClick={handleFaucetUsdc}
                disabled={fusdc.isPending || fusdc.isConfirming}
                className="w-full text-xs py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {fusdc.isPending || fusdc.isConfirming ? "Claiming..." : "Get 1K USDC"}
              </button>
            ) : (
              <p className="text-xs text-slate-600 text-center py-1">Faucet used</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
