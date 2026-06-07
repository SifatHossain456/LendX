import { formatUnits } from "viem";

/**
 * Format WETH amount (18 decimals) to human-readable string
 * @param wei    Raw WETH amount in wei (bigint)
 * @param dp     Decimal places to show (default 4)
 * @returns      e.g. "1.2345" or "0.5"
 */
export function fmtWeth(wei: bigint, dp = 4): string {
  return parseFloat(formatUnits(wei, 18))
    .toFixed(dp)
    .replace(/\.?0+$/, ""); // trim trailing zeros: "1.5000" → "1.5"
}

/**
 * Format USDC amount (6 decimals) to human-readable string with commas
 * @param units  Raw USDC amount in micro-USDC (bigint)
 * @param dp     Decimal places (default 2)
 * @returns      e.g. "1,500.00" or "0.25"
 */
export function fmtUsdc(units: bigint, dp = 2): string {
  return parseFloat(formatUnits(units, 6)).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/**
 * Format any token amount with specified decimals to USD display
 */
export function fmtUsd(units: bigint, decimals: number, dp = 2): string {
  return parseFloat(formatUnits(units, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

// ─── Health Factor Utilities ──────────────────────────────────────────────────
//
// Health factor is stored in 1e18 fixed point in the contract.
// type(uint256).max = infinite health (no debt position).
// 1e18 = 1.0 (liquidation threshold)
// 1.5e18 = 1.5 (healthy)
// 0.9e18 = 0.9 (liquidatable)

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

/**
 * Format health factor bigint to display string
 * @param hf  Health factor in 1e18 (type(uint256).max = infinite)
 * @returns   "∞" | "1.21" | "0.95" etc.
 */
export function fmtHF(hf: bigint): string {
  if (hf === MAX_UINT256) return "∞";
  return parseFloat(formatUnits(hf, 18)).toFixed(2);
}

/**
 * Tailwind color class based on health factor
 * >= 1.5: green (healthy)
 * >= 1.2: yellow (caution)
 * >= 1.0: orange (at risk)
 * <  1.0: red (liquidatable)
 */
export function hfColor(hf: bigint): string {
  if (hf === MAX_UINT256) return "text-green-400";
  const n = parseFloat(formatUnits(hf, 18));
  if (n >= 1.5) return "text-green-400";
  if (n >= 1.2) return "text-yellow-400";
  if (n >= 1.0) return "text-orange-400";
  return "text-red-400";
}

/**
 * Health factor as 0-100 percentage for the progress bar
 * Maps 0 HF → 0%, 2.0 HF → 100%
 */
export function hfPct(hf: bigint): number {
  if (hf === MAX_UINT256) return 100;
  const n = parseFloat(formatUnits(hf, 18));
  return Math.min(100, Math.round((n / 2) * 100));
}

/**
 * Utilization rate from BPS to percentage
 * @param bps  Utilization in basis points (0-10000)
 * @returns    0-100 percentage
 */
export function utilizationPct(bps: bigint): number {
  return Math.min(100, Number(bps) / 100);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
