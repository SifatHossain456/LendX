// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MockOracle.sol";
import "./LendToken.sol";

/**
 * @title LendX
 * @notice Collateralized lending protocol — supply WETH, borrow USDC
 * @author LendX Protocol
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║              COLLATERALIZED LENDING — CORE CONCEPTS                  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  1. COLLATERAL & BORROWING                                           ║
 * ║     You lock up Asset A (collateral) to borrow Asset B.             ║
 * ║     The protocol never holds more debt than collateral value.       ║
 * ║     Why overcollateralized? Price volatility. If ETH drops 20%,    ║
 * ║     the collateral still covers the debt + liquidation costs.       ║
 * ║                                                                      ║
 * ║  2. LTV (Loan-to-Value Ratio)                                        ║
 * ║     Maximum borrow = collateralValue × LTV                          ║
 * ║     LendX LTV = 75%: $1000 WETH → max borrow $750 USDC             ║
 * ║     Lower LTV = safer protocol, harder to use. Aave WETH LTV = 80% ║
 * ║                                                                      ║
 * ║  3. HEALTH FACTOR                                                    ║
 * ║     health = (collateralValue × liquidationThreshold) / debt        ║
 * ║     health > 1.0 → position is safe                                 ║
 * ║     health < 1.0 → position can be liquidated                       ║
 * ║     health = 1.0 exactly → at the edge, any price move = liquidate  ║
 * ║                                                                      ║
 * ║     Example: ETH = $2000, supply 1 WETH, borrow 1400 USDC          ║
 * ║     health = (2000 × 0.85) / 1400 = 1700/1400 = 1.21 ✓            ║
 * ║     ETH drops to $1600:                                              ║
 * ║     health = (1600 × 0.85) / 1400 = 1360/1400 = 0.97 ✗ LIQUIDATE  ║
 * ║                                                                      ║
 * ║  4. LIQUIDATION                                                      ║
 * ║     When health < 1: anyone can repay part of the borrower's debt   ║
 * ║     and receive collateral at a 5% discount (liquidation bonus).    ║
 * ║     This incentivizes keepers to monitor and liquidate bad debt.    ║
 * ║                                                                      ║
 * ║     Liquidator pays: debtAmount USDC                                 ║
 * ║     Liquidator receives: debtValue × 1.05 worth of WETH             ║
 * ║                                                                      ║
 * ║  5. INTEREST ACCRUAL                                                 ║
 * ║     LendX uses simple interest: borrowerDebt grows per second.      ║
 * ║     debtWithInterest = principal × (1 + rate × timeElapsed)         ║
 * ║     Rate: 5% APR = 5e18 / (365 days in seconds) per second per $   ║
 * ║                                                                      ║
 * ║     Real protocols use compound interest and a utilization-based    ║
 * ║     rate model (higher utilization → higher rates to attract         ║
 * ║     more suppliers). Aave uses a "kink" model.                      ║
 * ║                                                                      ║
 * ║  6. UTILIZATION RATE                                                 ║
 * ║     utilization = totalBorrowed / totalSupplied                      ║
 * ║     High utilization → liquidity crunch → can't withdraw            ║
 * ║     Rate model increases APR at high utilization to incentivize     ║
 * ║     new deposits and discourage new borrows.                         ║
 * ║                                                                      ║
 * ║  7. CEI PATTERN (Checks-Effects-Interactions)                        ║
 * ║     The golden rule of DeFi security:                               ║
 * ║       CHECKS:      validate inputs, state preconditions             ║
 * ║       EFFECTS:     update contract state first                      ║
 * ║       INTERACTIONS: call external contracts last                     ║
 * ║     Violating CEI opens reentrancy attacks. Always update balances  ║
 * ║     BEFORE transferring tokens out.                                  ║
 * ║                                                                      ║
 * ║  8. REENTRANCY ATTACKS                                               ║
 * ║     An attacker contract can call back into LendX during a          ║
 * ║     safeTransfer() call before state is updated.                    ║
 * ║     Example: withdraw() sends ETH → attacker receives ETH →         ║
 * ║       attacker calls withdraw() again before balance updates.       ║
 * ║     Defense: ReentrancyGuard (mutex lock) + CEI pattern.            ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @dev Architecture note:
 *      This is a simplified single-asset lending pool (WETH → USDC).
 *      Aave v3 uses a more complex architecture:
 *        - PoolAddressesProvider (upgradeable registry)
 *        - Pool (main entry point)
 *        - aTokens (yield-bearing receipt tokens)
 *        - VariableDebtTokens (tracked borrowings)
 *        - PriceOracle (Chainlink aggregation)
 *        - ReserveLogic, ValidationLogic (library separation)
 *      LendX collapses all of this into one contract for clarity.
 */
contract LendX is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────
    //                        PROTOCOL PARAMETERS
    // ─────────────────────────────────────────────────────────────────────
    //
    // All percentage parameters are in "basis points" (BPS):
    //   1 BPS = 0.01%
    //   100 BPS = 1%
    //   10000 BPS = 100%
    //
    // Using BPS avoids floating point: 75% = 7500 BPS
    // Math: value × 7500 / 10000 = value × 75%
    //
    // Why not use 1e18 for percentages? BPS is simpler to read and
    // sufficient precision for protocol parameters. 1e18 is used for
    // computed values (health factor) that need finer precision.

    /// @notice Maximum borrowable = collateralValue × 75%
    /// @dev Aave WETH LTV = 80% (8000 BPS). We use 75% for extra safety margin.
    uint256 public constant LTV_BPS = 7500;

    /// @notice Liquidation threshold = 85% of collateral value
    /// @dev The health factor denominator. Borrowers are liquidatable when:
    ///      collateralValue × 85% < debt
    ///      This gives a 10% buffer above the LTV before liquidation kicks in.
    ///      Buffer = liquidation threshold (85%) - LTV (75%) = 10%
    ///      This 10% absorbs price moves before liquidation is triggered.
    uint256 public constant LIQUIDATION_THRESHOLD = 8500;

    /// @notice Liquidation bonus = 5% discount on seized collateral
    /// @dev Liquidators receive 5% more collateral than they pay in debt.
    ///      This is the economic incentive for "keepers" (bots + users)
    ///      to liquidate bad debt. Too low → no incentive, bad debt grows.
    ///      Too high → large haircut for borrowers, discourages borrowing.
    ///      Aave WETH liquidation bonus = 5-10% depending on the asset.
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    /// @notice 5% APR expressed as a per-second rate in 1e18 fixed point
    /// @dev Calculation:
    ///      5% APR = 0.05 per year
    ///      0.05 / 365 / 86400 = 1.5854895991882294e-9 per second
    ///      In 1e18 fixed point: 1.585... × 1e18 ≈ 1_585_489_599
    ///
    ///      Usage: interest = principal × RATE × elapsed / 1e18
    ///      Example: 1000 USDC for 1 year:
    ///        interest = 1000e6 × 1_585_489_599 × 31_536_000 / 1e18
    ///                 = 1000e6 × 50_000_000_000_000_000 / 1e18
    ///                 = 1000e6 × 0.05 = 50e6 = 50 USDC ✓
    ///
    ///      This is SIMPLE interest. Compound interest (Aave) uses:
    ///        debt = principal × (1 + rate)^time
    ///      Compound accrues interest ON interest, growing faster.
    ///      For testnet demos, simple interest is sufficient.
    uint256 public constant INTEREST_RATE_PER_SEC = 1_585_489_599;

    /// @notice Denominator for basis point calculations
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice 1e18 precision constant for fixed-point arithmetic
    /// @dev Used as the base unit for health factor and interest calculations.
    ///      Health factor of 1.21 is stored as 1_210_000_000_000_000_000.
    uint256 public constant PRECISION = 1e18;

    /// @notice Health factor below which a position is liquidatable
    /// @dev 1.0 in 1e18 fixed point = 1_000_000_000_000_000_000
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;

    // ─────────────────────────────────────────────────────────────────────
    //                            TOKENS
    // ─────────────────────────────────────────────────────────────────────

    /// @notice WETH — the collateral token (18 decimals)
    /// @dev Users deposit WETH to unlock borrowing power.
    ///      `immutable` means the value is set once in the constructor
    ///      and baked into the bytecode — cheaper to read than `storage`.
    IERC20 public immutable collateralToken;

    /// @notice USDC — the borrow asset (6 decimals)
    /// @dev Users borrow USDC against their WETH collateral.
    IERC20 public immutable borrowToken;

    /// @notice Price oracle for WETH/USD conversions
    MockOracle public immutable oracle;

    /// @notice WETH with faucet (typed for faucet access)
    LendToken public immutable collateralLendToken;

    /// @notice USDC with faucet (typed for faucet access)
    LendToken public immutable borrowLendToken;

    // ─────────────────────────────────────────────────────────────────────
    //                          USER STATE
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Per-user lending position
     *
     * @dev Why a struct?
     *      We could use separate mappings (address → collateral, address → debt)
     *      but a struct is cleaner and uses one storage slot lookup.
     *
     *      Solidity Storage Layout:
     *        Each storage slot is 32 bytes.
     *        uint256 takes exactly one 32-byte slot.
     *        This struct uses 3 slots (3 × 32 = 96 bytes per user).
     *
     *      Optimization: Pack smaller types together in one slot:
     *        uint128 collateral + uint128 principal = 1 slot (saves gas)
     *        But we use uint256 for simplicity (no overflow risk).
     */
    struct UserPosition {
        /// @dev WETH deposited in wei (18 decimals). 1 WETH = 1e18.
        uint256 collateralAmount;
        /// @dev USDC borrowed principal in micro-USDC (6 decimals). 1 USDC = 1e6.
        ///      Does NOT include accrued interest — interest is calculated dynamically.
        uint256 borrowPrincipal;
        /// @dev Unix timestamp when the borrow was initiated (or last reset).
        ///      Used with block.timestamp to compute time elapsed for interest.
        ///      Reset to block.timestamp on each borrow/repay action.
        ///      Set to 0 when debt is fully repaid.
        uint256 borrowTimestamp;
    }

    /// @notice Mapping from user address to their lending position
    /// @dev Public mapping auto-generates a getter: positions(address) → (uint256,uint256,uint256)
    mapping(address => UserPosition) public positions;

    // ─────────────────────────────────────────────────────────────────────
    //                        PROTOCOL TOTALS
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Total WETH locked as collateral across all users (18 decimals)
    uint256 public totalCollateral;

    /// @notice Total USDC principal borrowed across all users (6 decimals)
    /// @dev Does not include accrued interest (tracked per-user via timestamps).
    uint256 public totalBorrowed;

    /// @notice Total USDC seeded into the protocol as lendable liquidity (6 decimals)
    /// @dev In real protocols, this grows as suppliers deposit.
    ///      In LendX, the owner seeds this once in deployment.
    uint256 public totalSupplied;

    // ─────────────────────────────────────────────────────────────────────
    //                        CUSTOM ERRORS
    // ─────────────────────────────────────────────────────────────────────
    //
    // Custom errors (Solidity 0.8.4+):
    //   - Cheaper than revert strings: only store the 4-byte selector
    //   - ABI-decodable: frontends can display helpful error messages
    //   - Can carry parameters: error Foo(uint256 got, uint256 expected)
    //
    // Gas comparison (approximate):
    //   require(cond, "string")  → stores string in bytecode + REVERT cost
    //   revert CustomError()     → only 4-byte selector, ~50-100 gas cheaper

    error ZeroAmount();             // Input is 0
    error InsufficientCollateral(); // Not enough WETH deposited
    error ExceedsLTV();             // Borrow would exceed 75% LTV
    error HealthFactorTooLow();     // Withdrawal would make position unsafe
    error HealthFactorOK();         // Cannot liquidate a healthy position
    error InsufficientLiquidity();  // Protocol doesn't have enough USDC
    error NoBorrowPosition();       // User has no debt to repay
    error ExceedsDebt();            // Repay amount exceeds total debt

    // ─────────────────────────────────────────────────────────────────────
    //                            EVENTS
    // ─────────────────────────────────────────────────────────────────────
    //
    // Events are stored in transaction logs (not contract storage).
    // They're cheap to emit and invaluable for:
    //   - Frontend real-time updates (via WebSocket subscriptions)
    //   - Analytics/indexing (TheGraph, Dune)
    //   - Debugging (visible in Etherscan transaction logs)
    //
    // `indexed` parameters can be filtered: up to 3 per event.
    // Non-indexed parameters are ABI-encoded in the "data" field.

    event Supplied(address indexed user, uint256 collateralAmount);
    event Withdrawn(address indexed user, uint256 collateralAmount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount, uint256 interest);
    event Liquidated(
        address indexed liquidator,
        address indexed borrower,
        uint256 debtRepaid,
        uint256 collateralSeized
    );

    // ─────────────────────────────────────────────────────────────────────
    //                          CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @param _collateralToken  Address of WETH token contract
     * @param _borrowToken      Address of USDC token contract
     * @param _oracle           Address of MockOracle contract
     *
     * @dev Multiple inheritance: Ownable + ReentrancyGuard
     *      Ownable(msg.sender) → sets deployer as owner (can call seedLiquidity)
     *      ReentrancyGuard → initializes mutex lock state to NOT_ENTERED (1)
     *
     *      Why cast to both IERC20 and LendToken?
     *        - IERC20 interface for standard token operations (transfer, etc.)
     *        - LendToken for protocol-specific functions (faucet)
     *        - Storing both avoids re-casting in every call
     */
    constructor(
        address _collateralToken,
        address _borrowToken,
        address _oracle
    ) Ownable(msg.sender) {
        collateralToken     = IERC20(_collateralToken);
        borrowToken         = IERC20(_borrowToken);
        oracle              = MockOracle(_oracle);
        collateralLendToken = LendToken(_collateralToken);
        borrowLendToken     = LendToken(_borrowToken);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                        SUPPLY COLLATERAL
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit WETH as collateral to unlock borrowing power
     * @param amount  WETH amount in wei (18 decimals). 1 WETH = 1e18.
     *
     * @dev CEI Pattern:
     *      CHECKS:      amount > 0 (prevents useless zero-collateral calls)
     *      EFFECTS:     update positions and totalCollateral BEFORE transfer
     *      INTERACTIONS: safeTransferFrom pulls WETH from caller
     *
     *      Note: nonReentrant modifier (from ReentrancyGuard) wraps this function.
     *      It sets a mutex: first call sets _status = ENTERED (2).
     *      Any reentrant call finds _status == ENTERED and reverts.
     *      After function completes: _status = NOT_ENTERED (1).
     *
     *      Why SafeERC20?
     *      Some ERC20 tokens (like old USDT) don't return a bool on transfer.
     *      SafeERC20.safeTransferFrom() handles non-standard tokens by:
     *        1. Checking if return data exists
     *        2. If yes: decoding and asserting it's `true`
     *        3. If no return data: assuming success (non-standard tokens)
     *
     *      Aave equivalent: pool.supply(asset, amount, onBehalfOf, referralCode)
     *      In Aave, supply earns aTokens (yield-bearing receipts). Here we skip
     *      aTokens for simplicity — collateral earns no yield.
     *
     * @dev In a production protocol, you'd also:
     *      - Emit a supply index (for yield tracking)
     *      - Mint aTokens to the depositor
     *      - Update reserve state (liquidity index)
     */
    function supply(uint256 amount) external nonReentrant {
        // CHECKS
        if (amount == 0) revert ZeroAmount();

        // EFFECTS — update state before external call
        positions[msg.sender].collateralAmount += amount;
        totalCollateral += amount;

        // INTERACTIONS — external call last
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Supplied(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                       WITHDRAW COLLATERAL
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw WETH collateral back to your wallet
     * @param amount  WETH amount in wei to withdraw
     *
     * @dev Health factor check AFTER simulated withdrawal:
     *      We cannot check health factor BEFORE updating state, because
     *      the health factor depends on the NEW collateral amount.
     *
     *      Correct approach (used here):
     *        1. Deduct collateral from position
     *        2. Compute health factor with NEW (lower) collateral
     *        3. If health < 1: REVERT — the state change is undone
     *        4. If health >= 1: proceed, send tokens
     *
     *      The revert undoes all state changes (Solidity is atomic).
     *      This is safe because we haven't done external calls yet (CEI).
     *
     *      Edge case: user with no debt can always withdraw freely.
     *      We skip the health check when borrowPrincipal == 0.
     */
    function withdraw(uint256 amount) external nonReentrant {
        // CHECKS
        if (amount == 0) revert ZeroAmount();

        UserPosition storage pos = positions[msg.sender];
        if (amount > pos.collateralAmount) revert InsufficientCollateral();

        // EFFECTS — simulate withdrawal first
        pos.collateralAmount -= amount;
        totalCollateral      -= amount;

        // Health check AFTER state update (CEI-compliant)
        // If user has debt, the reduced collateral might push them under
        if (pos.borrowPrincipal > 0) {
            uint256 hf = _healthFactor(msg.sender);
            if (hf < MIN_HEALTH_FACTOR) revert HealthFactorTooLow();
        }

        // INTERACTIONS — transfer tokens out last
        collateralToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                             BORROW
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Borrow USDC against supplied WETH collateral
     * @param amount  USDC amount in micro-USDC (6 decimals). 1000 USDC = 1000e6.
     *
     * @dev Borrow limit calculation (step by step):
     *
     *      Given:
     *        - collateralAmount = 1 WETH = 1e18 (18 decimals)
     *        - ethPrice = $2000 = 2000 × 1e8 = 200_000_000_000 (8 decimals)
     *        - LTV = 75% = 7500 BPS
     *
     *      Step 1: collateral value in USD (with 18 decimal precision)
     *        collateralValueUSD = collateralAmount × ethPrice / 1e8
     *        collateralValueUSD = 1e18 × 200_000_000_000 / 1e8
     *        collateralValueUSD = 1e18 × 2000 = 2000e18
     *        (this is "$2000" with 18 decimal precision)
     *
     *      Step 2: apply LTV
     *        maxBorrowUSD = 2000e18 × 7500 / 10000 = 1500e18
     *        (this is "$1500" with 18 decimal precision)
     *
     *      Step 3: convert to USDC units (6 decimals)
     *        maxBorrowUSDC = 1500e18 / 1e12 = 1500e6
     *        (USDC has 6 decimals: 1500e6 = 1500 USDC)
     *
     *      Division by 1e12: bridge between 18-decimal USD and 6-decimal USDC.
     *
     *      Multiple borrows: interest on existing debt is "crystallized"
     *      (folded into principal) before recording the new borrow.
     *      The timestamp resets to now, so interest restarts from 0.
     *      This prevents double-counting interest.
     *
     * @dev Invariant maintained: after borrow, totalDebt <= maxBorrow(user)
     */
    function borrow(uint256 amount) external nonReentrant {
        // CHECKS
        if (amount == 0) revert ZeroAmount();

        UserPosition storage pos = positions[msg.sender];
        if (pos.collateralAmount == 0) revert InsufficientCollateral();

        // Crystallize existing interest into principal before new borrow
        // This ensures the timestamp reset doesn't lose accrued interest
        if (pos.borrowPrincipal > 0) {
            uint256 interest = _pendingInterest(msg.sender);
            pos.borrowPrincipal += interest;
        }

        // Add new borrow to principal
        pos.borrowPrincipal += amount;

        // Reset interest clock to now
        // Interest on the new total principal starts accumulating from this moment
        pos.borrowTimestamp = block.timestamp;

        // LTV check: total debt (including crystallized interest) must not exceed 75% of collateral
        uint256 maxBorrowAmount = _maxBorrow(msg.sender);
        if (pos.borrowPrincipal > maxBorrowAmount) revert ExceedsLTV();

        // Liquidity check: protocol must have enough USDC to lend
        // totalBorrowed tracks outstanding debt; contract balance = totalSupplied - totalBorrowed
        if (borrowToken.balanceOf(address(this)) < amount) revert InsufficientLiquidity();

        // EFFECTS
        totalBorrowed += amount;

        // INTERACTIONS — send USDC to borrower
        borrowToken.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                             REPAY
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Repay USDC debt (principal + accrued interest)
     * @param amount  USDC to repay. Pass type(uint256).max to repay everything.
     *
     * @dev Interest calculation:
     *
     *      Simple interest formula:
     *        interest = principal × rate × timeElapsed
     *
     *      With our constants:
     *        interest = borrowPrincipal × INTEREST_RATE_PER_SEC × elapsed / PRECISION
     *
     *      Example: 1000 USDC borrowed for 30 days:
     *        elapsed = 30 × 86400 = 2_592_000 seconds
     *        interest = 1000e6 × 1_585_489_599 × 2_592_000 / 1e18
     *                 = 1000e6 × 4_109_589_041_808 / 1e18
     *                 = 1000e6 × 0.004109... = 4109 (micro-USDC) ≈ $0.004
     *        ~0.41% for 30 days → ~5% APR ✓
     *
     *      Payment order: interest is paid FIRST, then principal.
     *      This mirrors real-world loan amortization and is the safest
     *      approach for the protocol (ensures interest revenue is collected).
     *
     *      type(uint256).max trick: Solidity max uint is ~1.15 × 10^77.
     *      If the user passes this, we cap it at totalDebt.
     *      Saves the user from calculating exact debt (including interest)
     *      off-chain. Very common pattern in DeFi (used by Aave).
     *
     * @dev After full repayment:
     *      - borrowPrincipal = 0
     *      - borrowTimestamp = 0
     *      - User can freely withdraw all collateral
     */
    function repay(uint256 amount) external nonReentrant {
        UserPosition storage pos = positions[msg.sender];

        // CHECKS
        if (pos.borrowPrincipal == 0) revert NoBorrowPosition();

        // Calculate total debt (principal + accrued interest)
        uint256 interest  = _pendingInterest(msg.sender);
        uint256 totalDebt = pos.borrowPrincipal + interest;

        // Cap repayment at total debt (handles type(uint256).max)
        if (amount > totalDebt) amount = totalDebt;

        // EFFECTS — update state before pulling tokens (CEI)
        // Interest is applied to principal first (already accrued)
        // Payment waterfall: interest → principal
        uint256 interestPaid  = amount >= interest ? interest : amount;
        uint256 principalPaid = amount - interestPaid;

        pos.borrowPrincipal -= principalPaid;
        pos.borrowTimestamp  = block.timestamp; // Reset interest clock

        // Clean up timestamp when fully repaid
        if (pos.borrowPrincipal == 0) pos.borrowTimestamp = 0;

        // Update protocol total (only principal tracked here)
        totalBorrowed = totalBorrowed > principalPaid ? totalBorrowed - principalPaid : 0;

        // INTERACTIONS — pull USDC from user
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Repaid(msg.sender, principalPaid, interestPaid);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                          LIQUIDATION
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Liquidate an undercollateralized position
     * @param borrower     Address of the user to liquidate
     * @param repayAmount  USDC to repay on behalf of the borrower
     *
     * @dev Liquidation mechanics (detailed):
     *
     *      WHEN CAN LIQUIDATION OCCUR?
     *        healthFactor(borrower) < 1e18 (i.e., < 1.0)
     *        This means: collateralValue × 85% < totalDebt
     *
     *      WHAT DOES THE LIQUIDATOR DO?
     *        1. Call liquidate(borrower, repayAmount)
     *        2. Protocol pulls repayAmount USDC from liquidator
     *        3. Protocol gives liquidator WETH worth repayAmount × 105%
     *        4. Borrower's debt is reduced by repayAmount
     *        5. Borrower's collateral is reduced by seized WETH
     *
     *      COLLATERAL SEIZED CALCULATION:
     *        repayAmount is in USDC (6 decimals), price ≈ $1
     *        collateralSeized (in WETH, 18 decimals) =
     *          repayAmount × 1e8 (USDC price in 8 decimals) × 10500 / 10000 × 1e18
     *          ─────────────────────────────────────────────────────────────────
     *          ethPrice (8 decimals) × 10000 × 1e6 (USDC decimals adjustment)
     *
     *        Simplified: collateralSeized = repayAmount × 1.05 / ethPriceUSDC
     *        Where ethPriceUSDC = ethPrice (in USDC) = ethPrice_8dec / 1e2 (since USDC is 6 dec, price is 8 dec)
     *
     *        Example: repayAmount = 1000 USDC, ETH = $2000, bonus = 5%
     *          collateralSeized = 1000 × 1.05 / 2000 = 0.525 WETH = 0.525e18 ✓
     *
     *      CLOSE FACTOR (50%):
     *        Maximum debt repayable per liquidation = totalDebt / 2.
     *        Why not liquidate 100%?
     *          1. Gives borrower a chance to recover (add collateral, repay themselves)
     *          2. Prevents profitable "whale" liquidations that harm users
     *          3. Aave uses 50% close factor for most assets
     *        If health < some "dangerous" threshold (Aave uses 0.95), full liquidation allowed.
     *
     *      ECONOMIC FLOW:
     *        Liquidator: -1000 USDC → +0.525 WETH (worth $1050) → profit $50
     *        Borrower:   -0.525 WETH → -1000 USDC debt → position partially healed
     *        Protocol:   +1000 USDC (repaid) → -0.525 WETH (given to liquidator)
     *
     *      THE LIQUIDATION INCENTIVE PROBLEM:
     *        If liquidation bonus is too small, keepers won't liquidate (gas costs > profit).
     *        If too large, users lose too much collateral → discourages borrowing.
     *        5% is standard for highly liquid assets (ETH, BTC).
     *        For illiquid assets (small-cap tokens), bonuses can be 10-20%.
     */
    function liquidate(address borrower, uint256 repayAmount) external nonReentrant {
        // CHECKS

        // Cannot liquidate healthy positions — protects borrowers from predatory liquidation
        if (_healthFactor(borrower) >= MIN_HEALTH_FACTOR) revert HealthFactorOK();

        UserPosition storage pos = positions[borrower];
        uint256 interest  = _pendingInterest(borrower);
        uint256 totalDebt = pos.borrowPrincipal + interest;

        // 50% close factor: can't liquidate more than half in one call
        uint256 maxRepay = totalDebt / 2;
        if (repayAmount > maxRepay) repayAmount = maxRepay;
        if (repayAmount == 0) revert ZeroAmount();

        // Calculate WETH to seize
        // ethPrice has 8 decimals (Chainlink format: $2000 = 200_000_000_000)
        uint256 ethPrice = oracle.getPrice(address(collateralToken));

        // collateralSeized formula breakdown:
        //   repayAmount (USDC, 6 dec) × 1e8 (USDC price in 8-dec USD) = USD value in 14-dec
        //   × (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS) / BPS_DENOMINATOR = apply 1.05x bonus
        //   × 1e18 = scale to WETH precision (18 dec)
        //   / ethPrice (8 dec) = convert USD to ETH
        //   / BPS_DENOMINATOR = already divided above (restructured for clarity)
        //   / 1e6 = remove USDC decimal adjustment
        //
        // Net: 1e8 × 1e18 / 1e8 / 1e6 = 1e12 adjustment for USDC→WETH decimal bridging
        uint256 collateralSeized = (repayAmount * 1e8 * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS) * 1e18)
            / (ethPrice * BPS_DENOMINATOR * 1e6);

        // Cap at available collateral (prevents underflow if position is deeply underwater)
        if (collateralSeized > pos.collateralAmount) {
            collateralSeized = pos.collateralAmount;
        }

        // EFFECTS — update borrower's position before external calls
        uint256 principalToReduce = repayAmount > interest ? repayAmount - interest : 0;
        pos.borrowPrincipal  -= principalToReduce;
        pos.collateralAmount -= collateralSeized;
        pos.borrowTimestamp   = block.timestamp;

        // Clean up if fully liquidated
        if (pos.borrowPrincipal == 0) pos.borrowTimestamp = 0;

        // Update protocol totals
        totalBorrowed   = totalBorrowed > principalToReduce ? totalBorrowed - principalToReduce : 0;
        totalCollateral -= collateralSeized;

        // INTERACTIONS
        // Pull USDC from liquidator (they pay the borrower's debt)
        borrowToken.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Send seized WETH to liquidator (their profit)
        collateralToken.safeTransfer(msg.sender, collateralSeized);

        emit Liquidated(msg.sender, borrower, repayAmount, collateralSeized);
    }

    // ─────────────────────────────────────────────────────────────────────
    //                          VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────
    //
    // View functions don't modify state — they're free to call off-chain
    // and cost gas only when called from other contracts.
    //
    // Batched views (getStats, getUserData) reduce frontend RPC calls.
    // Instead of 5 separate eth_call requests, one call returns all data.
    // This is critical for UX: fewer RPC calls = faster load times.

    /**
     * @notice Health factor in 1e18 fixed point
     * @param user  Address to check
     * @return Health factor (>1e18 = safe, <1e18 = liquidatable, max = no debt)
     *
     * @dev Health factor formula:
     *      health = (collateralValue × liquidationThreshold) / totalDebt
     *
     *      Both collateral and debt converted to the same unit (USD, 1e18 precision)
     *      before division to avoid precision loss.
     *
     *      Returns type(uint256).max when borrowPrincipal == 0 (infinite health).
     *      Frontend should display this as "∞" or "No Debt".
     */
    function healthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }

    /**
     * @notice Total debt including accrued interest
     * @param user  Borrower address
     * @return Total USDC owed (6 decimals)
     */
    function totalDebt(address user) external view returns (uint256) {
        UserPosition memory pos = positions[user];
        if (pos.borrowPrincipal == 0) return 0;
        return pos.borrowPrincipal + _pendingInterest(user);
    }

    /**
     * @notice Maximum USDC borrowable given current collateral (before LTV cap)
     * @param user  User address
     * @return Maximum USDC in micro-USDC (6 decimals)
     *
     * @dev This is the GROSS maximum. Available borrow = maxBorrow - currentDebt.
     *      The frontend shows "available to borrow" = max(0, maxBorrow - debt).
     */
    function maxBorrow(address user) external view returns (uint256) {
        return _maxBorrow(user);
    }

    /**
     * @notice Protocol-level statistics for the dashboard
     * @return _totalCollateral  Total WETH locked (18 decimals)
     * @return _totalBorrowed    Total USDC principal owed (6 decimals)
     * @return _totalSupplied    Total USDC seeded as liquidity (6 decimals)
     * @return _utilizationBps  Borrow utilization in BPS (0-10000)
     * @return _ethPrice         ETH/USD price (8 decimals)
     *
     * @dev try/catch for oracle.getPrice():
     *      If oracle reverts (price not set), we gracefully return 0 for ethPrice
     *      instead of making the entire getStats() call fail.
     *      The frontend handles ethPrice == 0 by showing "—".
     */
    function getStats() external view returns (
        uint256 _totalCollateral,
        uint256 _totalBorrowed,
        uint256 _totalSupplied,
        uint256 _utilizationBps,
        uint256 _ethPrice
    ) {
        uint256 utilization = totalSupplied == 0 ? 0 : (totalBorrowed * BPS_DENOMINATOR) / totalSupplied;
        uint256 ethPrice;
        try oracle.getPrice(address(collateralToken)) returns (uint256 p) {
            ethPrice = p;
        } catch {}
        return (totalCollateral, totalBorrowed, totalSupplied, utilization, ethPrice);
    }

    /**
     * @notice All user data in a single RPC call
     * @param user  Address to query
     * @return collateralAmount  WETH deposited (18 decimals)
     * @return debtAmount        Total USDC owed including interest (6 decimals)
     * @return maxBorrowAmount   Maximum USDC borrowable (6 decimals)
     * @return hf                Health factor (1e18 precision, max = uint256.max)
     * @return pendingInterest_  Accrued but unpaid interest (6 decimals)
     *
     * @dev Saves 4 RPC calls compared to querying each field separately.
     *      Frontend calls this every 5 seconds to keep UI in sync.
     */
    function getUserData(address user) external view returns (
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 maxBorrowAmount,
        uint256 hf,
        uint256 pendingInterest_
    ) {
        UserPosition memory pos = positions[user];
        uint256 interest = pos.borrowPrincipal > 0 ? _pendingInterest(user) : 0;
        return (
            pos.collateralAmount,
            pos.borrowPrincipal + interest,
            _maxBorrow(user),
            _healthFactor(user),
            interest
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    //                          ADMIN FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Seed the protocol with USDC borrowing liquidity
     * @param amount  USDC to deposit (6 decimals)
     *
     * @dev In real lending protocols, liquidity comes from depositors who earn interest.
     *      Aave flow: user calls supply(USDC) → receives aUSDC → earns yield from borrowers.
     *
     *      In LendX (simplified for education):
     *        - The deployer seeds USDC directly from their wallet
     *        - No supplier yield is tracked
     *        - The interest paid by borrowers accumulates in the contract
     *
     *      This means the deployer is effectively the "sole supplier" and would
     *      earn all the interest in a real version. For testnet demos, this is fine.
     *
     *      Called once in deploy.js after deployment:
     *        await usdc.approve(lendxAddr, 100_000e6);
     *        await lendx.seedLiquidity(100_000e6);
     */
    function seedLiquidity(uint256 amount) external onlyOwner {
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        totalSupplied += amount;
    }

    // ─────────────────────────────────────────────────────────────────────
    //                        INTERNAL FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @dev Compute health factor with full precision
     *
     *      Formula: health = (collateralValue × LIQ_THRESHOLD × PRECISION)
     *                        / (debtUSD × BPS_DENOMINATOR)
     *
     *      Why multiply by PRECISION before dividing?
     *      Integer division truncates: 7 / 10 = 0 (wrong!)
     *      Multiplying first: 7 × 1e18 / 10 = 7e17 (= 0.7 in 1e18 fixed point) ✓
     *
     *      Unit analysis for health factor:
     *        collateralValueUSD: (1e18 WETH × 1e8 price / 1e8) = USD in 1e18
     *        debtUSD: (1e6 USDC × 1e12) = USD in 1e18
     *        Both in same unit → ratio is dimensionless (scaled by 1e18)
     *
     *      Returns type(uint256).max for no-debt positions:
     *        Frontend check: if (hf == type(uint256).max) display "∞"
     *        Can use: if (hf == BigInt("0xffff...ffff")) return "∞"
     */
    function _healthFactor(address user) internal view returns (uint256) {
        UserPosition memory pos = positions[user];

        // Infinite health when no debt
        if (pos.borrowPrincipal == 0) return type(uint256).max;

        uint256 debt = pos.borrowPrincipal + _pendingInterest(user);

        // Collateral value in USD, 1e18 precision
        // collateralAmount (1e18 units WETH) × price (1e8 USD/ETH) / 1e8 = USD with 1e18 decimals
        uint256 ethPrice = oracle.getPrice(address(collateralToken));
        uint256 collateralValueUSD = pos.collateralAmount * ethPrice / 1e8;

        // Debt in USD, 1e18 precision
        // debt (1e6 units USDC) × 1e12 = USD with 1e18 decimals (USDC ≈ $1)
        uint256 debtUSD = debt * 1e12;

        // Health factor = (collateral × liquidationThreshold) / debt
        // Both in 1e18 USD, PRECISION cancels out the BPS_DENOMINATOR
        return (collateralValueUSD * LIQUIDATION_THRESHOLD * PRECISION)
            / (debtUSD * BPS_DENOMINATOR);
    }

    /**
     * @dev Compute maximum borrowable USDC given current collateral
     *
     *      Math trace for 1 WETH at $2000 ETH price, 75% LTV:
     *        ethPrice = 2000e8
     *        collateralValueUSDC = 1e18 × 2000e8 / 1e8 / 1e12 = 1e18 × 2000 / 1e12 = 2000e6
     *        maxBorrow = 2000e6 × 7500 / 10000 = 1500e6 = 1500 USDC ✓
     *
     *      Division by 1e12 bridges:
     *        - WETH precision: 1e18 decimal places
     *        - Price precision: 1e8 decimal places → USD in 1e18 after × and /1e8
     *        - USDC precision: 1e6 decimal places
     *        USD(1e18) / 1e12 = USDC(1e6) ✓
     */
    function _maxBorrow(address user) internal view returns (uint256) {
        UserPosition memory pos = positions[user];
        if (pos.collateralAmount == 0) return 0;

        uint256 ethPrice = oracle.getPrice(address(collateralToken));

        // collateralAmount (1e18) × price (1e8) / 1e8 / 1e12 = USDC (1e6)
        uint256 collateralValueUSDC = pos.collateralAmount * ethPrice / 1e8 / 1e12;

        // Apply 75% LTV
        return collateralValueUSDC * LTV_BPS / BPS_DENOMINATOR;
    }

    /**
     * @dev Compute interest accrued since last borrow/repay
     *
     *      Simple interest: I = P × r × t
     *        P = borrowPrincipal (USDC in 1e6)
     *        r = INTEREST_RATE_PER_SEC (in 1e18 per second, = 5% APR)
     *        t = elapsed (seconds since borrowTimestamp)
     *
     *      Result is in USDC (1e6) because:
     *        P (1e6) × r (1e18) × t / PRECISION (1e18) = P (1e6)
     *
     *      Edge cases handled:
     *        - borrowPrincipal == 0: no debt → return 0
     *        - borrowTimestamp == 0: debt was fully repaid → return 0
     *        - elapsed == 0: same block as borrow → return 0 (no time passed)
     *
     * @dev Note: This uses `block.timestamp` which miners can manipulate slightly
     *      (±15 seconds on PoW, predictable on PoS). For interest at ~5% APR,
     *      15-second manipulation is negligible (0.000024% per 15 sec).
     *      Protocols that use timestamps for economic decisions at scale
     *      should be aware of this, but it's fine for lending interest.
     */
    function _pendingInterest(address user) internal view returns (uint256) {
        UserPosition memory pos = positions[user];
        if (pos.borrowPrincipal == 0 || pos.borrowTimestamp == 0) return 0;

        uint256 elapsed = block.timestamp - pos.borrowTimestamp;

        // I = P × r × t / 1e18
        // Using 1e18 denominator because INTEREST_RATE_PER_SEC is in 1e18 fixed point
        return pos.borrowPrincipal * INTEREST_RATE_PER_SEC * elapsed / PRECISION;
    }
}
