"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import {
  LENDX_ADDRESS,
  LENDX_ABI,
  WETH_ADDRESS,
  USDC_ADDRESS,
  LEND_TOKEN_ABI,
} from "@/lib/contracts";

// ─────────────────────────────────────────────────────────────────────────────
// READ HOOKS
// These hooks wrap wagmi's useReadContract for specific LendX views.
// They auto-refetch every N seconds to keep the UI in sync.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protocol-level statistics (total collateral, borrowed, utilization, ETH price)
 * Refetches every 8 seconds — market stats change less often than user data.
 */
export function useProtocolStats() {
  return useReadContract({
    address: LENDX_ADDRESS,
    abi: LENDX_ABI,
    functionName: "getStats",
    query: {
      refetchInterval: 8000,
    },
  });
}

/**
 * User's full position data (collateral, debt, maxBorrow, health factor, interest)
 * Refetches every 5 seconds — user data changes with each block (interest accrues).
 * Only enabled when a wallet is connected.
 */
export function useUserData() {
  const { address } = useAccount();
  return useReadContract({
    address: LENDX_ADDRESS,
    abi: LENDX_ABI,
    functionName: "getUserData",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });
}

/**
 * Wallet balances, allowances, and faucet status for WETH and USDC.
 * Returns a combined object for easy destructuring in components.
 */
export function useTokenBalances() {
  const { address } = useAccount();

  const weth = useReadContract({
    address: WETH_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const usdc = useReadContract({
    address: USDC_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const wethAllowance = useReadContract({
    address: WETH_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, LENDX_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const usdcAllowance = useReadContract({
    address: USDC_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, LENDX_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const wethFaucetUsed = useReadContract({
    address: WETH_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "hasUsedFaucet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const usdcFaucetUsed = useReadContract({
    address: USDC_ADDRESS,
    abi: LEND_TOKEN_ABI,
    functionName: "hasUsedFaucet",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    wethBal:        weth.data ?? 0n,
    usdcBal:        usdc.data ?? 0n,
    wethAllowance:  wethAllowance.data ?? 0n,
    usdcAllowance:  usdcAllowance.data ?? 0n,
    wethFaucetUsed: wethFaucetUsed.data ?? false,
    usdcFaucetUsed: usdcFaucetUsed.data ?? false,
    refetch: () => {
      weth.refetch();
      usdc.refetch();
      wethAllowance.refetch();
      usdcAllowance.refetch();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HOOKS — each hook typed directly to avoid wagmi ABI inference issues
// ─────────────────────────────────────────────────────────────────────────────

export function useApproveWeth() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const approve = (amount: bigint) =>
    writeContractAsync({ address: WETH_ADDRESS, abi: LEND_TOKEN_ABI, functionName: "approve", args: [LENDX_ADDRESS, amount] });
  return { approve, isPending, isConfirming, isSuccess };
}

export function useApproveUsdc() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const approve = (amount: bigint) =>
    writeContractAsync({ address: USDC_ADDRESS, abi: LEND_TOKEN_ABI, functionName: "approve", args: [LENDX_ADDRESS, amount] });
  return { approve, isPending, isConfirming, isSuccess };
}

export function useFaucetWeth() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const claim = () =>
    writeContractAsync({ address: WETH_ADDRESS, abi: LEND_TOKEN_ABI, functionName: "faucet" });
  return { claim, isPending, isConfirming, isSuccess };
}

export function useFaucetUsdc() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const claim = () =>
    writeContractAsync({ address: USDC_ADDRESS, abi: LEND_TOKEN_ABI, functionName: "faucet" });
  return { claim, isPending, isConfirming, isSuccess };
}

export function useSupply() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const supply = (amt: bigint) =>
    writeContractAsync({ address: LENDX_ADDRESS, abi: LENDX_ABI, functionName: "supply", args: [amt] });
  return { supply, isPending, isConfirming, isSuccess };
}

export function useWithdraw() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const withdraw = (amt: bigint) =>
    writeContractAsync({ address: LENDX_ADDRESS, abi: LENDX_ABI, functionName: "withdraw", args: [amt] });
  return { withdraw, isPending, isConfirming, isSuccess };
}

export function useBorrow() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const borrow = (amt: bigint) =>
    writeContractAsync({ address: LENDX_ADDRESS, abi: LENDX_ABI, functionName: "borrow", args: [amt] });
  return { borrow, isPending, isConfirming, isSuccess };
}

export function useRepay() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const repay = (amt: bigint) =>
    writeContractAsync({ address: LENDX_ADDRESS, abi: LENDX_ABI, functionName: "repay", args: [amt] });
  return { repay, isPending, isConfirming, isSuccess };
}

export function useLiquidate() {
  const { writeContractAsync, isPending, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const liquidate = (borrower: `0x${string}`, repayAmount: bigint) =>
    writeContractAsync({ address: LENDX_ADDRESS, abi: LENDX_ABI, functionName: "liquidate", args: [borrower, repayAmount] });
  return { liquidate, isPending, isConfirming, isSuccess };
}
