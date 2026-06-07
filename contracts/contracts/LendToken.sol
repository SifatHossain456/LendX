// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendToken
 * @notice Generic ERC20 faucet token for LendX testnet demo
 * @author LendX Protocol
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                  ERC20 TOKENS — CORE CONCEPTS                        ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  ERC20 is a token standard (Ethereum Request for Comment #20).      ║
 * ║  Any contract implementing these functions is "ERC20 compatible":   ║
 * ║    - totalSupply()                                                   ║
 * ║    - balanceOf(address)                                              ║
 * ║    - transfer(to, amount)                                            ║
 * ║    - approve(spender, amount)                                        ║
 * ║    - transferFrom(from, to, amount)  ← used by protocols            ║
 * ║    - allowance(owner, spender)                                       ║
 * ║                                                                      ║
 * ║  APPROVE + TRANSFERFROM PATTERN:                                     ║
 * ║  To let LendX pull WETH from your wallet:                           ║
 * ║    1. User calls: weth.approve(lendxAddr, amount)                   ║
 * ║       → sets allowance[user][lendx] = amount                        ║
 * ║    2. LendX calls: weth.transferFrom(user, lendx, amount)           ║
 * ║       → checks allowance, deducts it, moves tokens                  ║
 * ║                                                                      ║
 * ║  DECIMALS:                                                           ║
 * ║  Tokens don't store fractional amounts — all amounts are integers.  ║
 * ║  "1 WETH" is stored as 1_000_000_000_000_000_000 (1e18).           ║
 * ║  "1 USDC" is stored as 1_000_000 (1e6).                            ║
 * ║  This is why you must always account for decimals in math.          ║
 * ║                                                                      ║
 * ║  FAUCET PATTERN:                                                     ║
 * ║  Testnet tokens need a way for users to get them without paying.    ║
 * ║  The faucet mints tokens to the caller. One-time-per-address limit  ║
 * ║  prevents bots from draining the supply.                            ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * This contract is deployed twice:
 *   1. WETH (Wrapped Ether) — 18 decimals, used as collateral
 *      Faucet amount: 1 WETH (1e18 units)
 *   2. USDC (USD Coin) — 6 decimals, used as borrow asset
 *      Faucet amount: 1000 USDC (1000 * 1e6 units)
 */
contract LendToken is ERC20, Ownable {

    // ─── State Variables ─────────────────────────────────────────────────

    /// @dev Custom decimals — ERC20 defaults to 18, we override for USDC (6)
    uint8 private _decimals;

    /// @notice Amount minted per faucet call
    uint256 public faucetAmount;

    /// @notice Tracks which addresses have already used the faucet
    /// @dev Prevents the same address from minting repeatedly.
    ///      In production USDC, minting is controlled by the issuer (Circle).
    mapping(address => bool) public hasUsedFaucet;

    // ─── Custom Errors ───────────────────────────────────────────────────
    // Custom errors (Solidity 0.8.4+) are cheaper than revert strings.
    // They encode the error selector (4 bytes) instead of a full string.
    // Gas cost: ~100 gas cheaper per revert than string-based require().
    error FaucetAlreadyUsed();

    // ─── Constructor ─────────────────────────────────────────────────────

    /**
     * @param name          Token name ("Wrapped Ether" / "USD Coin")
     * @param symbol        Token symbol ("WETH" / "USDC")
     * @param decimals_     Token decimals (18 for WETH, 6 for USDC)
     * @param _faucetAmount Units minted per faucet call (in token's smallest unit)
     *
     * @dev ERC20(name, symbol) calls the parent constructor.
     *      Ownable(msg.sender) sets the deployer as owner.
     *      Initial mint gives the deployer 1,000,000 tokens for seeding liquidity.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 _faucetAmount
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
        faucetAmount = _faucetAmount;

        // Mint initial supply to deployer
        // For USDC: 1,000,000 * 1e6 = 1 trillion raw units
        // For WETH: 1,000,000 * 1e18 = 1e24 raw units
        // The deployer will use this to seed LendX with USDC liquidity
        _mint(msg.sender, 1_000_000 * (10 ** decimals_));
    }

    // ─── Overrides ───────────────────────────────────────────────────────

    /**
     * @notice Returns the number of decimals used for display
     * @dev ERC20 defaults to 18 decimals. We override to allow USDC (6 decimals).
     *      This is a VIEW function — no state change, no gas cost when called off-chain.
     *      Important: decimals() is just for display. The actual stored values are always integers.
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    // ─── Faucet ──────────────────────────────────────────────────────────

    /**
     * @notice Claim test tokens — one time per address
     *
     * @dev Why one-time faucet?
     *      If users could call faucet() unlimited times, they could:
     *      1. Supply infinite collateral
     *      2. Borrow all USDC from the protocol
     *      3. Leave the protocol insolvent
     *      The one-time limit is still gameable (use different wallets),
     *      but adds enough friction for a testnet demo.
     *
     *      Real testnet tokens from Circle/Uniswap have off-chain rate limits.
     *
     *      Gas optimization: `revert FaucetAlreadyUsed()` vs `require(!hasUsedFaucet[msg.sender], "used")`
     *      The custom error saves ~50-100 gas on revert paths.
     */
    function faucet() external {
        if (hasUsedFaucet[msg.sender]) revert FaucetAlreadyUsed();
        hasUsedFaucet[msg.sender] = true;
        _mint(msg.sender, faucetAmount);
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    /**
     * @notice Mint tokens to any address (owner only)
     * @param to      Recipient address
     * @param amount  Amount in smallest token unit (wei for WETH, 1e-6 for USDC)
     *
     * @dev Used by the deployer script to re-seed liquidity if needed.
     *      In production USDC, this is controlled by Circle's multi-sig.
     *      Unlimited minting power is a centralization risk — noted for education.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
