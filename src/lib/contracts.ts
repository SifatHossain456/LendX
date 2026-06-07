// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT ADDRESSES
// After deploying with: cd contracts && npx hardhat run scripts/deploy.js --network baseSepolia
// Copy the printed addresses here.
// ─────────────────────────────────────────────────────────────────────────────

export const WETH_ADDRESS   = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const USDC_ADDRESS   = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const ORACLE_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
export const LENDX_ADDRESS  = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// ERC20 ABI — Minimal interface for token interactions
// ─────────────────────────────────────────────────────────────────────────────
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LEND TOKEN ABI — ERC20 + faucet functions
// ─────────────────────────────────────────────────────────────────────────────
export const LEND_TOKEN_ABI = [
  ...ERC20_ABI,
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "hasUsedFaucet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// LENDX ABI — Full protocol interface
// ─────────────────────────────────────────────────────────────────────────────
export const LENDX_ABI = [
  // ── Write functions ──
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "liquidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "repayAmount", type: "uint256" },
    ],
    outputs: [],
  },
  // ── View functions ──
  {
    name: "healthFactor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalDebt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxBorrow",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalCollateral", type: "uint256" },
      { name: "_totalBorrowed",   type: "uint256" },
      { name: "_totalSupplied",   type: "uint256" },
      { name: "_utilizationBps", type: "uint256" },
      { name: "_ethPrice",       type: "uint256" },
    ],
  },
  {
    name: "getUserData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateralAmount",  type: "uint256" },
      { name: "debtAmount",        type: "uint256" },
      { name: "maxBorrowAmount",   type: "uint256" },
      { name: "hf",                type: "uint256" },
      { name: "pendingInterest_",  type: "uint256" },
    ],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "borrowPrincipal",  type: "uint256" },
      { name: "borrowTimestamp",  type: "uint256" },
    ],
  },
  {
    name: "LTV_BPS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "LIQUIDATION_THRESHOLD",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ── Events ──
  {
    name: "Supplied",
    type: "event",
    inputs: [
      { indexed: true,  name: "user",             type: "address" },
      { indexed: false, name: "collateralAmount",  type: "uint256" },
    ],
  },
  {
    name: "Borrowed",
    type: "event",
    inputs: [
      { indexed: true,  name: "user",   type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    name: "Repaid",
    type: "event",
    inputs: [
      { indexed: true,  name: "user",     type: "address" },
      { indexed: false, name: "amount",   type: "uint256" },
      { indexed: false, name: "interest", type: "uint256" },
    ],
  },
  {
    name: "Liquidated",
    type: "event",
    inputs: [
      { indexed: true,  name: "liquidator",     type: "address" },
      { indexed: true,  name: "borrower",        type: "address" },
      { indexed: false, name: "debtRepaid",      type: "uint256" },
      { indexed: false, name: "collateralSeized", type: "uint256" },
    ],
  },
] as const;
