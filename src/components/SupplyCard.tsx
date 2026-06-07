"use client";

import { useState } from "react";
import { parseEther, formatEther } from "viem";
import {
  useTokenBalances,
  useApproveWeth,
  useSupply,
  useWithdraw,
  useUserData,
} from "@/hooks/useLendX";
import { fmtWeth } from "@/lib/utils";

type Tab = "supply" | "withdraw";

/**
 * SupplyCard — Deposit and withdraw WETH collateral
 *
 * Flow for Supply:
 *   1. User enters WETH amount
 *   2. If allowance < amount → show "Approve WETH" button
 *   3. User approves → allowance updated
 *   4. User clicks "Supply WETH" → LendX.supply(amount) called
 *   5. WETH transferred from wallet to LendX
 *
 * Flow for Withdraw:
 *   1. User enters WETH amount
 *   2. Click "Withdraw WETH" → LendX.withdraw(amount) called
 *   3. Contract checks health factor would remain >= 1.0
 *   4. WETH transferred from LendX back to wallet
 *
 * The two-step approve+supply is the ERC20 standard pattern.
 * Alternative: EIP-2612 permit (gasless approval via signature).
 */
export function SupplyCard() {
  const [tab, setTab]       = useState<Tab>("supply");
  const [amount, setAmount] = useState("");

  const balances  = useTokenBalances();
  const userData  = useUserData();
  const approve   = useApproveWeth();
  const supply    = useSupply();
  const withdraw  = useWithdraw();

  const collateral = userData.data?.[0] ?? 0n;

  // Parse user input to wei (safe: returns 0n on invalid input)
  const amountWei = (() => {
    try { return parseEther(amount || "0"); } catch { return 0n; }
  })();

  // Need approval if supplying more than current allowance
  const needsApproval =
    tab === "supply" && balances.wethAllowance < amountWei && amountWei > 0n;

  // Any pending transaction
  const busy =
    approve.isPending || approve.isConfirming ||
    supply.isPending  || supply.isConfirming  ||
    withdraw.isPending || withdraw.isConfirming;

  // Button label based on state
  const buttonLabel = (() => {
    if (busy)          return "Confirm in wallet...";
    if (needsApproval) return "Approve WETH";
    return tab === "supply" ? "Supply WETH" : "Withdraw WETH";
  })();

  const handleSubmit = async () => {
    if (amountWei === 0n || busy) return;
    try {
      if (tab === "supply") {
        if (needsApproval) {
          // Step 1: Approve LendX to spend WETH
          await approve.approve(amountWei);
          balances.refetch();
          return; // User must click again to supply after approval
        }
        // Step 2: Supply WETH
        await supply.supply(amountWei);
      } else {
        // Withdraw WETH (no approval needed — pulling from own position)
        await withdraw.withdraw(amountWei);
      }
      setAmount("");
      balances.refetch();
      userData.refetch();
    } catch {
      // Errors are shown by the wallet — no need to handle here
    }
  };

  // MAX button logic
  const maxAmount = tab === "supply"
    ? formatEther(balances.wethBal)
    : formatEther(collateral);

  // Validation: warn if amount exceeds available
  const maxAmountWei = tab === "supply" ? balances.wethBal : collateral;
  const exceedsMax   = amountWei > maxAmountWei && amountWei > 0n;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(["supply", "withdraw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-150 ${
              tab === t
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
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
          {tab === "supply"
            ? `Wallet: ${fmtWeth(balances.wethBal)} WETH`
            : `Deposited: ${fmtWeth(collateral)} WETH`}
        </span>
        {tab === "supply" && balances.wethAllowance > 0n && (
          <span className="text-slate-600">
            Approved: {fmtWeth(balances.wethAllowance)} WETH
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
          step="0.0001"
          className={`w-full bg-white/5 border rounded-xl px-4 py-3.5 pr-24 text-white text-lg font-mono placeholder-slate-600 focus:outline-none transition-colors ${
            exceedsMax
              ? "border-red-500/50 focus:border-red-500"
              : "border-white/10 focus:border-emerald-500/50"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={() => setAmount(maxAmount)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-1.5 py-0.5 rounded-md hover:bg-emerald-500/10 transition"
          >
            MAX
          </button>
          <span className="text-slate-400 text-sm font-medium">WETH</span>
        </div>
      </div>

      {/* Exceeded max warning */}
      {exceedsMax && (
        <p className="text-xs text-red-400 font-medium">
          Exceeds {tab === "supply" ? "wallet balance" : "deposited amount"}
        </p>
      )}

      {/* Approval flow hint */}
      {needsApproval && !busy && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          Step 1 of 2: Approve LendX to spend your WETH, then supply.
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!amount || amountWei === 0n || busy || exceedsMax}
        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
          needsApproval
            ? "bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white"
            : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
        } shadow-lg`}
      >
        {buttonLabel}
      </button>

      {/* Transaction success confirmation */}
      {(supply.isSuccess || withdraw.isSuccess) && (
        <p className="text-xs text-emerald-400 text-center font-medium animate-pulse">
          Transaction confirmed!
        </p>
      )}

      {/* Info footer */}
      <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2">
        <p className="text-xs text-slate-500">
          {tab === "supply"
            ? "Supplying WETH unlocks USDC borrowing power (75% LTV). No yield on collateral."
            : "Withdrawing reduces your borrow capacity. Position must stay healthy (HF ≥ 1.0)."}
        </p>
      </div>
    </div>
  );
}
