const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying LendX with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // ── Deploy WETH (collateral token) ──────────────────────────────────────
  // 18 decimals (standard for ETH-based tokens)
  // Faucet: 1 WETH per address (= 1e18 wei)
  const LendToken = await hre.ethers.getContractFactory("LendToken");
  const weth = await LendToken.deploy(
    "Wrapped Ether",
    "WETH",
    18,
    hre.ethers.parseEther("1") // 1 WETH faucet amount
  );
  await weth.waitForDeployment();
  const wethAddr = await weth.getAddress();
  console.log("WETH deployed:", wethAddr);

  // ── Deploy USDC (borrow asset) ───────────────────────────────────────────
  // 6 decimals (USDC standard)
  // Faucet: 1000 USDC per address (= 1000 * 1e6 micro-USDC)
  const usdc = await LendToken.deploy(
    "USD Coin",
    "USDC",
    6,
    1_000 * 1e6 // 1000 USDC faucet amount
  );
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("USDC deployed:", usdcAddr);

  // ── Deploy MockOracle ────────────────────────────────────────────────────
  // Set ETH price = $2000 (in 8-decimal Chainlink format)
  // $2000 = 2000 × 1e8 = 200_000_000_000
  const MockOracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();

  // Set prices (8 decimal Chainlink format)
  await (await oracle.setPrice(wethAddr, 2000n * 10n ** 8n)).wait(); // ETH = $2000
  await (await oracle.setPrice(usdcAddr, 1n * 10n ** 8n)).wait();    // USDC = $1

  console.log("MockOracle deployed:", oracleAddr);
  console.log("  ETH price set: $2000");
  console.log("  USDC price set: $1");

  // ── Deploy LendX ─────────────────────────────────────────────────────────
  const LendX = await hre.ethers.getContractFactory("LendX");
  const lendx = await LendX.deploy(wethAddr, usdcAddr, oracleAddr);
  await lendx.waitForDeployment();
  const lendxAddr = await lendx.getAddress();
  console.log("LendX deployed:", lendxAddr);

  // ── Seed LendX with USDC liquidity ──────────────────────────────────────
  // Give LendX 100,000 USDC so users can borrow
  // Deployer received 1,000,000 USDC at construction, so this is fine
  const seedAmount = 100_000n * 10n ** 6n; // 100,000 USDC
  await (await usdc.approve(lendxAddr, seedAmount)).wait();
  await (await lendx.seedLiquidity(seedAmount)).wait();
  console.log("Seeded 100,000 USDC liquidity");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n✅ LendX fully deployed on Base Sepolia!");
  console.log("─".repeat(55));
  console.log("WETH:      ", wethAddr);
  console.log("USDC:      ", usdcAddr);
  console.log("Oracle:    ", oracleAddr);
  console.log("LendX:     ", lendxAddr);
  console.log("\n--- Copy these into src/lib/contracts.ts ---");
  console.log(`export const WETH_ADDRESS   = "${wethAddr}" as \`0x\${string}\`;`);
  console.log(`export const USDC_ADDRESS   = "${usdcAddr}" as \`0x\${string}\`;`);
  console.log(`export const ORACLE_ADDRESS = "${oracleAddr}" as \`0x\${string}\`;`);
  console.log(`export const LENDX_ADDRESS  = "${lendxAddr}" as \`0x\${string}\`;`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
