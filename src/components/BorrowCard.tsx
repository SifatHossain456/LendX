"use client";

import { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import {
  useTokenBalances,
  useApproveUsdc,
  useBorrow,
  useRepay,
  useUserData,
} from "@/hooks/useLendX";
import { fmtUsdc, fmtHF, hfColor } from "@/lib/utils";
import { formatUnits as fuFormatUnits } from "viem";

type Tab = "borrow" | "repay";

/**
 * BorrowCard — Borrow and repay USDC against WETH collateral
 *
 * Borrow flow:
 *   1. User enters USDC amount (within available limit)
 *   2. Click "Borrow USDC" → LendX.borrow(amount)
 *   3. Contract verifies LTV ≤ 75%
 *   4. USDC transferred from protocol to user's wallet
 *
 * Repay flow:
 *   1. User enters USDC amount to repay
 *   2. If USDC allowance < amount → "Approve USDC" step first
 *   3. Click "Repay USDC" → LendX.repay(amount)
 *   4. Interest paid first, then principal
 *   5. Health factor improves
 *
 * Health factor preview:
 *   Shows current HF. In a full implementation, we'd compute
 *   the PROJECTED hf after the borrow/repay using a formula.
 *   Here we show the current HF as-is (refreshes every 5s).
 */
export function BorrowCard() {
  const [tab, setTab]       = useState<Tab>("borrow");
  const [amount, setAmount] = useState("");

  const balances = useTokenBalances();
  const userData = useUserData();
  const approve  = useApproveUsdc();
  const borrow   = useBorrow();
  const repay    = useRepay();

  const debt      = userData.data?.[1] ?? 0n;
  const maxBorrow = userData.data?.[2] ?? 0n;
  const hf        = userData.data?.[3] ?? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  // Amount in USDC micro-units (6 decimals)
  const amountUnits = (() => {
    try { return parseUnits(amount || "0", 6); } catch { return 0n; }
  })();

  // Available to borrow (remaining capacity)
  const available = maxBorrow > debt ? maxBorrow - debt : 0n;

  // Repay needs USDC approval (LendX must pull from wallet)
  const needsApproval =
    tab === "repay" && balances.usdcAllowance < amountUnits && amountUnits > 0n;

  const busy =
    approve.isPending || approve.isConfirming ||
    borrow.isPending  || borrow.isConfirming  ||
    repay.isPending   || repay.isConfirming;

  // Button label
  const buttonLabel = (() => {
    if (busy)          return "Confirm in wallet...";
    if (needsApproval) return "Approve USDC";
    return tab === "borrow" ? "Borrow USDC" : "Repay USDC";
  })();

  // Validation
  const exceedsBorrow = tab === "borrow" && amountUnits > available && amountUnits > 0n;
  const exceedsDebt   = tab === "repay"  && amountUnits > debt + (debt / 10n) && amountUnits > 0n;
  const hasError      = exceedsBorrow || exceedsDebt;

  const handleSubmit = async () => {
    if (amountUnits === 0n || busy || hasError) return;
    try {
      if (tab === "borrow") {
        await borrow.borrow(amountUnits);
      } else {
        if (needsApproval) {
          await approve.approve(amountUnits);
          balances.refetch();
          return; // Two-step: approve then repay
        }
        await repay.repay(amountUnits);
      }
      setAmount("");
      balances.refetch();
      userData.refetch();
    } catch {}
  };

  // MAX button values
  const maxBorrowStr = formatUnits(available, 6);
  const maxRepayStr  = formatUnits(debt, 6);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(["borrow", "repay"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-150 ${
              tab === t
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Context info */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {tab === "borrow"
            ? `Available: $${fmtUsdc(available)} USDC`
            : `Outstanding: $${fmtUsdc(debt)} USDC`}
        </span>
        {tab === "repay" && balances.usdcAllowance > 0n && (
          <span className="text-slate-600">
            Approved: ${fmtUsdc(balances.usdcAllowance)}
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="relative">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          step="1"
          className={`w-full bg-white/5 border rounded-xl px-4 py-3.5 pr-24 text-white text-lg font-mono placeholder-slate-600 focus:outline-none transition-colors ${
            hasError
              ? "border-red-500/50 focus:border-red-500"
              : "border-white/10 focus:border-blue-500/50"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={() => setAmount(tab === "borrow" ? maxBorrowStr : maxRepayStr)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold px-1.5 py-0.5 rounded-md hover:bg-blue-500/10 transition"
          >
            MAX
          </button>
          <span className="text-slate-400 text-sm font-medium">USDC</span>
        </div>
      </div>

      {/* Validation errors */}
      {exceedsBorrow && (
        <p className="text-xs text-red-400 font-medium">
          Exceeds available borrow limit (${fmtUsdc(available)} USDC)
        </p>
      )}
      {exceedsDebt && (
        <p className="text-xs text-red-400 font-medium">
          Exceeds outstanding debt (${fmtUsdc(debt)} USDC)
        </p>
      )}

      {/* Approval step hint */}
      {needsApproval && !busy && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          Step 1 of 2: Approve LendX to pull your USDC, then repay.
        </div>
      )}

      {/* Health factor display */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 block mb-0.5">Health Factor</span>
          <span className="text-xs text-slate-600">
            {tab === "borrow" ? "Borrowing reduces HF" : "Repaying improves HF"}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-black tabular-nums ${hfColor(hf)}`}>
            {fmtHF(hf)}
          </span>
          {hf < BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") && (
            <p className="text-xs text-slate-500 mt-0.5">
              {parseFloat(fuFormatUnits(hf, 18)) < 1.2 ? "⚠ Low" : "Safe"}
            </p>
          )}
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!amount || amountUnits === 0n || busy || hasError}
        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg ${
          needsApproval
            ? "bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
        }`}
      >
        {buttonLabel}
      </button>

      {/* Success confirmation */}
      {(borrow.isSuccess || repay.isSuccess) && (
        <p className="text-xs text-blue-400 text-center font-medium animate-pulse">
          Transaction confirmed!
        </p>
      )}

      {/* Info footer */}
      <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2">
        <p className="text-xs text-slate-500">
          {tab === "borrow"
            ? "Borrowed USDC accrues 5% APR (simple interest). Keep HF above 1.2 to avoid liquidation risk."
            : "Repaying reduces your debt and improves your health factor. Interest is paid before principal."}
        </p>
      </div>
    </div>
  );
}
