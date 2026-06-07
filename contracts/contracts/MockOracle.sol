// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @notice Simulates a Chainlink price feed for testnet use
 * @author LendX Protocol
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║               PRICE ORACLES IN DEFI — WHY THEY MATTER               ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  Problem: Smart contracts cannot access external data (prices).     ║
 * ║  The EVM is deterministic — every node must compute the same        ║
 * ║  result. If price data came from the internet, different nodes      ║
 * ║  might see different prices → consensus failure.                    ║
 * ║                                                                      ║
 * ║  Solution: Oracles bridge off-chain data to on-chain state.         ║
 * ║  Chainlink: decentralized network of nodes that aggregate prices    ║
 * ║  and publish on-chain. AggregatorV3Interface:                       ║
 * ║    latestRoundData() → (roundId, price, startedAt, updatedAt, _)   ║
 * ║  Price is in 8 decimals: $2000 ETH → 200000000000                  ║
 * ║                                                                      ║
 * ║  Oracle manipulation risk: a flash-loan attack that moves the DEX   ║
 * ║  price can exploit protocols using spot prices as oracles.          ║
 * ║  TWAP (time-weighted average price) mitigates this by averaging     ║
 * ║  price over many blocks — too expensive to manipulate.              ║
 * ║                                                                      ║
 * ║  This mock: owner sets price manually. Simple and transparent       ║
 * ║  for testnet demos. Production: use Chainlink AggregatorV3.         ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @dev Production-grade oracle checklist:
 *   - Use Chainlink AggregatorV3Interface.latestRoundData()
 *   - Always check the `updatedAt` timestamp — stale prices are dangerous
 *     (e.g., if Chainlink node goes offline during high volatility)
 *   - Check `answeredInRound >= roundId` to detect incomplete rounds
 *   - Consider using a TWAP fallback if Chainlink is stale
 *   - Never use UniswapV2/V3 spot price alone — susceptible to flash loans
 */
contract MockOracle is Ownable {

    // ─── Storage ─────────────────────────────────────────────────────────
    //
    // Price in USD with 8 decimals (matching Chainlink format)
    // e.g. ETH = $2000 → price = 200_000_000_000 (2000 * 1e8)
    //
    // Why 8 decimals? Chainlink standardized on 8 decimals for USD pairs.
    // For ETH/USD at $2000.50, Chainlink returns 200050000000 (200050000000 / 1e8 = 2000.5)
    // Some feeds use 18 decimals (e.g., ETH/ETH = 1e18), always check the feed.
    mapping(address => uint256) public prices;

    // ─── Events ──────────────────────────────────────────────────────────
    // Events are indexed logs stored in transaction receipts.
    // Frontends use them to react to state changes without polling.
    // `indexed` params allow filtering: oracle.queryFilter(oracle.filters.PriceSet(tokenAddr))
    event PriceSet(address indexed token, uint256 price);

    // ─── Constructor ─────────────────────────────────────────────────────
    // Ownable(msg.sender) sets the deployer as the owner.
    // OpenZeppelin v5 requires passing the initial owner explicitly.
    constructor() Ownable(msg.sender) {}

    // ─── Owner Functions ─────────────────────────────────────────────────

    /**
     * @notice Set token price in USD (8 decimals)
     * @param token  Token address whose price is being set
     * @param price  Price × 1e8 (e.g. $2000 = 200_000_000_000)
     *
     * @dev In production, this would be called by a decentralized oracle
     *      network (Chainlink DON) through a secure aggregation mechanism.
     *      Here, only the owner (deployer) can set prices — fine for testnet.
     *
     *      Security consideration: A malicious owner could manipulate prices
     *      to liquidate users unfairly. Production protocols either:
     *        a) Use immutable Chainlink feeds (no owner can change them)
     *        b) Use a multi-sig + timelock to set oracle parameters
     *        c) Use a price guardian that only allows prices within a % band
     */
    function setPrice(address token, uint256 price) external onlyOwner {
        require(price > 0, "Price must be positive");
        prices[token] = price;
        emit PriceSet(token, price);
    }

    /**
     * @notice Get token price in USD (8 decimals)
     * @param token  Token address to query
     * @return price  USD price with 8 decimal places
     *
     * @dev Called by LendX.sol to value collateral and compute health factor.
     *      The require guard prevents the protocol from operating with
     *      uninitialized prices (would return 0 → infinite borrowing power).
     *
     *      Chainlink equivalent:
     *        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
     *        require(block.timestamp - updatedAt < STALENESS_THRESHOLD, "Stale");
     *        require(price > 0, "Invalid price");
     */
    function getPrice(address token) external view returns (uint256) {
        require(prices[token] > 0, "Price not set");
        return prices[token];
    }
}
