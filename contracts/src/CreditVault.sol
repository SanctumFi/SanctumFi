// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IFtsoV2.sol";

/// @title CreditVault — TEE credit-scored lending engine for FlareScore
contract CreditVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes21 public constant FLR_USD_FEED_ID = bytes21(0x01464c522f55534400000000000000000000000000);
    bytes21 public constant XRP_USD_FEED_ID = bytes21(0x015852502f55534400000000000000000000000000);

    uint256 public constant FEE_RATE            = 500;    // 5% APR in basis points
    uint256 public constant LIQUIDATION_DISCOUNT = 500;   // 5% in basis points (unused in simple seize model)
    uint256 public constant BASIS_POINTS        = 10_000;

    // Minimum collateral ratio (basis points of debt that must be covered by collateral).
    // e.g. PLATINUM_LTV = 8000 means collateral must be >= 80% of debt (under-collateralised tier).
    // BRONZE_LTV = 20000 means collateral must be >= 200% of debt.
    uint256 public constant PLATINUM_LTV = 8_000;  // 80%  collateral ratio — score 800-1000
    uint256 public constant GOLD_LTV     = 12_000; // 120% collateral ratio — score 600-799
    uint256 public constant SILVER_LTV   = 15_000; // 150% collateral ratio — score 400-599
    uint256 public constant BRONZE_LTV   = 20_000; // 200% collateral ratio — score 0-399

    uint256 public constant HEALTH_PRECISION  = 1e18;
    uint256 public constant SECONDS_PER_YEAR  = 365 days;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    struct Position {
        uint256 creditScore;          // 0-1000, TEE attested
        uint256 scoreTimestamp;       // when score was computed
        uint256 flrCollateral;        // deposited WFLR amount (native FLR held by contract)
        uint256 fxrpCollateral;       // deposited FXRP amount
        uint256 flrDebt;              // borrowed FLR principal
        uint256 fxrpDebt;             // borrowed FXRP principal
        uint256 flrBorrowTimestamp;   // for fee accrual
        uint256 fxrpBorrowTimestamp;  // for fee accrual
    }

    mapping(address => Position) public positions;

    IFtsoV2  public immutable ftsoV2;
    IERC20   public immutable fxrp;
    address  public teeSigner;
    uint256  public immutable scoreExpiry;

    /// @notice Protocol-owned FLR liquidity (separate from user collateral).
    uint256 public poolFLR;
    /// @notice Protocol-owned FXRP liquidity (separate from user collateral).
    uint256 public poolFXRP;

    /// @notice Smart Account Receiver authorized to call *For proxy functions.
    address public smartAccountReceiver;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ScoreReceived(address indexed user, uint256 score, uint256 timestamp);
    event CollateralDeposited(address indexed user, address asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address asset, uint256 amount);
    event Borrowed(address indexed user, address asset, uint256 amount);
    event Repaid(address indexed user, address asset, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _ftsoV2,
        address _fxrp,
        address _teeSigner,
        uint256 _scoreExpiry
    ) Ownable(msg.sender) {
        ftsoV2      = IFtsoV2(_ftsoV2);
        fxrp        = IERC20(_fxrp);
        teeSigner   = _teeSigner;
        scoreExpiry = _scoreExpiry;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlySmartAccount() {
        require(msg.sender == smartAccountReceiver, "CreditVault: not SAR");
        _;
    }

    // -------------------------------------------------------------------------
    // Receive
    // -------------------------------------------------------------------------

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Pool funding (owner only)
    // -------------------------------------------------------------------------

    function fundPoolFLR() external payable onlyOwner {
        poolFLR += msg.value;
    }

    function fundPoolFXRP(uint256 amount) external onlyOwner {
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        poolFXRP += amount;
    }

    function setSmartAccountReceiver(address _sar) external onlyOwner {
        smartAccountReceiver = _sar;
    }

    function setTeeSigner(address _teeSigner) external onlyOwner {
        teeSigner = _teeSigner;
    }

    // -------------------------------------------------------------------------
    // Smart Account proxy functions (called by SmartAccountReceiver on behalf of XRPL users)
    // -------------------------------------------------------------------------

    function depositFLRFor(address user) external payable onlySmartAccount nonReentrant {
        positions[user].flrCollateral += msg.value;
        emit CollateralDeposited(user, address(0), msg.value);
    }

    function depositFXRPFor(address user, uint256 amount) external onlySmartAccount {
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        positions[user].fxrpCollateral += amount;
        emit CollateralDeposited(user, address(fxrp), amount);
    }

    function borrowFor(address user, address asset, uint256 amount) external onlySmartAccount nonReentrant {
        Position storage pos = positions[user];

        require(_hasValidScore(pos), "CreditVault: no valid score");
        require(amount > 0, "CreditVault: zero amount");

        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();

        if (asset == address(0)) {
            require(poolFLR >= amount, "CreditVault: insufficient pool FLR");
            pos.flrDebt += amount;
            if (pos.flrBorrowTimestamp == 0) pos.flrBorrowTimestamp = block.timestamp;
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(poolFXRP >= amount, "CreditVault: insufficient pool FXRP");
            pos.fxrpDebt += amount;
            if (pos.fxrpBorrowTimestamp == 0) pos.fxrpBorrowTimestamp = block.timestamp;
        }

        uint256 colUSD  = _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 debtUSD = _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        require(colUSD * BASIS_POINTS >= debtUSD * ltvBps, "CreditVault: exceeds LTV");

        // Borrowed funds sent to SmartAccountReceiver (holds on behalf of XRPL user).
        if (asset == address(0)) {
            poolFLR -= amount;
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "CreditVault: FLR transfer failed");
        } else {
            poolFXRP -= amount;
            fxrp.safeTransfer(msg.sender, amount);
        }

        emit Borrowed(user, asset, amount);
    }

    function withdrawCollateralFor(address user, address asset, uint256 amount) external onlySmartAccount nonReentrant {
        require(amount > 0, "CreditVault: zero amount");
        Position storage pos = positions[user];

        if (asset == address(0)) {
            require(pos.flrCollateral >= amount, "CreditVault: insufficient FLR collateral");
            pos.flrCollateral -= amount;
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(pos.fxrpCollateral >= amount, "CreditVault: insufficient FXRP collateral");
            pos.fxrpCollateral -= amount;
        }

        // If debt exists, ensure position is still healthy after withdrawal.
        uint256 debtUSD = _debtValueUSDCached(pos);
        if (debtUSD > 0) {
            uint256 colUSD = _collateralValueUSDCached(pos);
            uint256 ltvBps = getLtvBps(pos.creditScore);
            require(colUSD * BASIS_POINTS >= debtUSD * ltvBps, "CreditVault: would breach LTV");
        }

        if (asset == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "CreditVault: FLR transfer failed");
        } else {
            fxrp.safeTransfer(msg.sender, amount);
        }

        emit CollateralWithdrawn(user, asset, amount);
    }

    function repayFor(address user, address asset, uint256 amount) external payable onlySmartAccount nonReentrant {
        Position storage pos = positions[user];

        if (asset == address(0)) {
            require(pos.flrDebt > 0, "CreditVault: no FLR debt");

            (uint256 totalDebt,) = _getDebtWithFees(pos);
            uint256 repayAmount = msg.value > totalDebt ? totalDebt : msg.value;

            pos.flrDebt = totalDebt - repayAmount;
            pos.flrBorrowTimestamp = pos.flrDebt > 0 ? block.timestamp : 0;

            poolFLR += repayAmount;

            if (msg.value > repayAmount) {
                (bool ok,) = msg.sender.call{value: msg.value - repayAmount}("");
                require(ok, "CreditVault: refund failed");
            }

            emit Repaid(user, asset, repayAmount);
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(pos.fxrpDebt > 0, "CreditVault: no FXRP debt");

            (, uint256 totalDebt) = _getDebtWithFees(pos);
            uint256 repayAmount = amount > totalDebt ? totalDebt : amount;

            fxrp.safeTransferFrom(msg.sender, address(this), repayAmount);

            pos.fxrpDebt = totalDebt - repayAmount;
            pos.fxrpBorrowTimestamp = pos.fxrpDebt > 0 ? block.timestamp : 0;

            poolFXRP += repayAmount;

            emit Repaid(user, asset, repayAmount);
        }
    }

    // -------------------------------------------------------------------------
    // Score storage + collateral deposits
    // -------------------------------------------------------------------------

    /// @notice Anyone can relay a TEE-signed credit score for a user.
    function receiveScore(
        address user,
        uint256 score,
        uint256 timestamp,
        bytes calldata sig
    ) external {
        // Bug 4: verify ECDSA signature from the trusted TEE signer.
        bytes32 messageHash    = keccak256(abi.encodePacked(user, score, timestamp));
        bytes32 ethSignedHash  = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered      = ECDSA.recover(ethSignedHash, sig);
        require(recovered == teeSigner, "CreditVault: invalid TEE signature");

        require(score <= 1000, "CreditVault: score out of range");

        // Bug 5: validate timestamp — not from the future, not too old.
        require(timestamp <= block.timestamp, "CreditVault: future timestamp");
        require(block.timestamp - timestamp <= 1 hours, "CreditVault: score too old");

        positions[user].creditScore    = score;
        positions[user].scoreTimestamp = timestamp;

        emit ScoreReceived(user, score, timestamp);
    }

    /// @notice Deposit native FLR as collateral.
    function depositFLR() external payable nonReentrant {
        positions[msg.sender].flrCollateral += msg.value;
        emit CollateralDeposited(msg.sender, address(0), msg.value);
    }

    /// @notice Deposit FXRP ERC-20 as collateral.
    function depositFXRP(uint256 amount) external {
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].fxrpCollateral += amount;
        emit CollateralDeposited(msg.sender, address(fxrp), amount);
    }

    /// @notice Returns the minimum collateral ratio (in basis points) for a given credit score.
    function getLtvBps(uint256 score) public pure returns (uint256) {
        if (score >= 800) return PLATINUM_LTV;
        if (score >= 600) return GOLD_LTV;
        if (score >= 400) return SILVER_LTV;
        return BRONZE_LTV;
    }

    // -------------------------------------------------------------------------
    // Borrow, repay, liquidate
    // -------------------------------------------------------------------------

    /// @notice Borrow FLR (asset == address(0)) or FXRP (asset == fxrp address).
    function borrow(address asset, uint256 amount) external nonReentrant {
        Position storage pos = positions[msg.sender];

        require(_hasValidScore(pos), "CreditVault: no valid score");
        require(amount > 0, "CreditVault: zero amount");

        // Bug 7: fetch prices once.
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();

        // Apply new debt tentatively to check collateral ratio.
        if (asset == address(0)) {
            require(poolFLR >= amount, "CreditVault: insufficient pool FLR");
            pos.flrDebt += amount;
            if (pos.flrBorrowTimestamp == 0) pos.flrBorrowTimestamp = block.timestamp;
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(poolFXRP >= amount, "CreditVault: insufficient pool FXRP");
            pos.fxrpDebt += amount;
            if (pos.fxrpBorrowTimestamp == 0) pos.fxrpBorrowTimestamp = block.timestamp;
        }

        uint256 colUSD  = _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 debtUSD = _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // Bug 1: correct collateral ratio check.
        // colUSD * BASIS_POINTS >= debtUSD * ltvBps
        // e.g. Platinum: col * 10000 >= debt * 8000  → col >= debt * 0.8
        // e.g. Bronze:   col * 10000 >= debt * 20000 → col >= debt * 2.0
        require(colUSD * BASIS_POINTS >= debtUSD * ltvBps, "CreditVault: exceeds LTV");

        // Transfer asset to borrower.
        if (asset == address(0)) {
            poolFLR -= amount;
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "CreditVault: FLR transfer failed");
        } else {
            poolFXRP -= amount;
            fxrp.safeTransfer(msg.sender, amount);
        }

        emit Borrowed(msg.sender, asset, amount);
    }

    /// @notice Repay debt. For FLR send msg.value; for FXRP set amount and approve first.
    function repay(address asset, uint256 amount) external payable nonReentrant {
        Position storage pos = positions[msg.sender];

        if (asset == address(0)) {
            require(pos.flrDebt > 0, "CreditVault: no FLR debt");

            (uint256 totalDebt,) = _getDebtWithFees(pos);
            uint256 repayAmount = msg.value > totalDebt ? totalDebt : msg.value;

            // Bug 8: apply payment — reduce total debt, reset timestamp.
            pos.flrDebt = totalDebt - repayAmount;
            pos.flrBorrowTimestamp = pos.flrDebt > 0 ? block.timestamp : 0;

            // Return repayment to pool.
            poolFLR += repayAmount;

            // Refund excess.
            if (msg.value > repayAmount) {
                (bool ok,) = msg.sender.call{value: msg.value - repayAmount}("");
                require(ok, "CreditVault: refund failed");
            }

            emit Repaid(msg.sender, asset, repayAmount);
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(pos.fxrpDebt > 0, "CreditVault: no FXRP debt");

            (, uint256 totalDebt) = _getDebtWithFees(pos);
            uint256 repayAmount = amount > totalDebt ? totalDebt : amount;

            fxrp.safeTransferFrom(msg.sender, address(this), repayAmount);

            pos.fxrpDebt = totalDebt - repayAmount;
            pos.fxrpBorrowTimestamp = pos.fxrpDebt > 0 ? block.timestamp : 0;

            poolFXRP += repayAmount;

            emit Repaid(msg.sender, asset, repayAmount);
        }
    }

    /// @notice Withdraw collateral as long as the position remains healthy.
    function withdrawCollateral(address asset, uint256 amount) external nonReentrant {
        Position storage pos = positions[msg.sender];
        require(amount > 0, "CreditVault: zero amount");

        if (asset == address(0)) {
            require(pos.flrCollateral >= amount, "CreditVault: insufficient FLR collateral");
            pos.flrCollateral -= amount;
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(pos.fxrpCollateral >= amount, "CreditVault: insufficient FXRP collateral");
            pos.fxrpCollateral -= amount;
        }

        // If debt exists, ensure position is still healthy after withdrawal.
        uint256 debtUSD = _debtValueUSDCached(pos);
        if (debtUSD > 0) {
            uint256 colUSD = _collateralValueUSDCached(pos);
            uint256 ltvBps = getLtvBps(pos.creditScore);
            // Bug 1: same corrected collateral ratio check.
            require(colUSD * BASIS_POINTS >= debtUSD * ltvBps, "CreditVault: would breach LTV");
        }

        if (asset == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "CreditVault: FLR transfer failed");
        } else {
            fxrp.safeTransfer(msg.sender, amount);
        }

        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    /// @notice Liquidate an unhealthy position: seize all collateral, clear all debt.
    function liquidate(address user) external nonReentrant {
        Position storage pos = positions[user];

        require(_hasDebt(pos), "CreditVault: no debt");

        // Bug 7: fetch prices once for liquidation check.
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();

        uint256 colUSD  = _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 debtUSD = _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // Bug 1: position is liquidatable when colUSD * BASIS_POINTS < debtUSD * ltvBps.
        require(colUSD * BASIS_POINTS < debtUSD * ltvBps, "CreditVault: position healthy");

        uint256 flrCol  = pos.flrCollateral;
        uint256 fxrpCol = pos.fxrpCollateral;

        // Clear position.
        pos.flrCollateral       = 0;
        pos.fxrpCollateral      = 0;
        pos.flrDebt             = 0;
        pos.fxrpDebt            = 0;
        pos.flrBorrowTimestamp  = 0;
        pos.fxrpBorrowTimestamp = 0;

        // Transfer collateral to liquidator (pool is not debited — debt absorbed as bad debt).
        if (flrCol > 0) {
            (bool ok,) = msg.sender.call{value: flrCol}("");
            require(ok, "CreditVault: FLR seize failed");
        }
        if (fxrpCol > 0) {
            fxrp.safeTransfer(msg.sender, fxrpCol);
        }

        emit Liquidated(user, msg.sender);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Returns current debt with fees for a user.
    function getDebt(address user) external view returns (uint256 flrDebt, uint256 fxrpDebt) {
        Position storage pos = positions[user];
        flrDebt  = _flrDebtWithFees(pos);
        fxrpDebt = _fxrpDebtWithFees(pos);
    }

    /// @notice Returns health factor scaled by HEALTH_PRECISION (1e18 = healthy minimum).
    /// @dev    Not view because FTSO getFeedById is payable (but no ETH is consumed here).
    function getHealthFactor(address user) public returns (uint256) {
        Position storage pos = positions[user];

        // Bug 7: fetch prices once.
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();

        uint256 debtUSD = _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        if (debtUSD == 0) return type(uint256).max;

        uint256 colUSD  = _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // Bug 1: health = (collateralUSD * BASIS_POINTS) / (debtUSD * ltvBps)
        // >= 1.0 (scaled to HEALTH_PRECISION) means position is healthy.
        return (colUSD * BASIS_POINTS * HEALTH_PRECISION) / (debtUSD * ltvBps);
    }

    /// @notice Returns how much more of `asset` the user can borrow given current collateral.
    /// @dev    Not view because FTSO getFeedById is payable (but no ETH is consumed here).
    function getMaxBorrow(address user, address asset) external returns (uint256) {
        Position storage pos = positions[user];
        if (!_hasValidScore(pos)) return 0;

        // Bug 7: fetch prices once.
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();

        uint256 colUSD  = _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 debtUSD = _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // Bug 1: maxDebtUSD = colUSD * BASIS_POINTS / ltvBps
        // (inversion of the check: col * BASIS_POINTS >= debt * ltvBps)
        uint256 maxDebtUSD = colUSD * BASIS_POINTS / ltvBps;
        if (maxDebtUSD <= debtUSD) return 0;

        uint256 remainingUSD = maxDebtUSD - debtUSD;

        // Convert remainingUSD back to asset units.
        if (asset == address(0)) {
            return _fromUSD(remainingUSD, flrPrice, flrDec);
        } else {
            return _fromUSD(remainingUSD, xrpPrice, xrpDec);
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Bug 6: guard against zero price from FTSO.
    function _getFlrPriceUSD() internal returns (uint256 price, int8 decimals) {
        uint64 ts;
        (price, decimals, ts) = ftsoV2.getFeedById(FLR_USD_FEED_ID);
        require(price > 0, "CreditVault: invalid FLR price");
    }

    /// @dev Bug 6: guard against zero price from FTSO.
    function _getXrpPriceUSD() internal returns (uint256 price, int8 decimals) {
        uint64 ts;
        (price, decimals, ts) = ftsoV2.getFeedById(XRP_USD_FEED_ID);
        require(price > 0, "CreditVault: invalid XRP price");
    }

    /// @dev Normalize an asset amount to USD value.
    function _toUSD(uint256 amount, uint256 price, int8 dec) internal pure returns (uint256) {
        if (dec >= 0) {
            uint256 d = uint256(uint8(dec));
            return (amount * price) / (10 ** d);
        } else {
            uint256 d = uint256(uint8(-dec));
            return amount * price * (10 ** d);
        }
    }

    function _fromUSD(uint256 usdAmount, uint256 price, int8 dec) internal pure returns (uint256) {
        if (price == 0) return 0;
        if (dec >= 0) {
            uint256 d = uint256(uint8(dec));
            return (usdAmount * (10 ** d)) / price;
        } else {
            uint256 d = uint256(uint8(-dec));
            return usdAmount / (price * (10 ** d));
        }
    }

    /// @dev Bug 7: accept pre-fetched prices to avoid duplicate FTSO calls.
    function _collateralValueUSD(
        Position storage pos,
        uint256 flrPrice,
        int8 flrDec,
        uint256 xrpPrice,
        int8 xrpDec
    ) internal view returns (uint256) {
        return _toUSD(pos.flrCollateral, flrPrice, flrDec)
             + _toUSD(pos.fxrpCollateral, xrpPrice, xrpDec);
    }

    /// @dev Bug 7: accept pre-fetched prices to avoid duplicate FTSO calls.
    function _debtValueUSD(
        Position storage pos,
        uint256 flrPrice,
        int8 flrDec,
        uint256 xrpPrice,
        int8 xrpDec
    ) internal view returns (uint256) {
        return _toUSD(_flrDebtWithFees(pos), flrPrice, flrDec)
             + _toUSD(_fxrpDebtWithFees(pos), xrpPrice, xrpDec);
    }

    /// @dev Convenience wrappers that fetch prices internally (used where a single call is acceptable).
    function _collateralValueUSDCached(Position storage pos) internal returns (uint256) {
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();
        return _collateralValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
    }

    function _debtValueUSDCached(Position storage pos) internal returns (uint256) {
        (uint256 flrPrice, int8 flrDec) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec) = _getXrpPriceUSD();
        return _debtValueUSD(pos, flrPrice, flrDec, xrpPrice, xrpDec);
    }

    function _accrueFee(uint256 principal, uint256 borrowTimestamp) internal view returns (uint256) {
        if (principal == 0 || borrowTimestamp == 0) return 0;
        uint256 elapsed = block.timestamp - borrowTimestamp;
        return principal + (principal * FEE_RATE * elapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);
    }

    function _flrDebtWithFees(Position storage pos) internal view returns (uint256) {
        return _accrueFee(pos.flrDebt, pos.flrBorrowTimestamp);
    }

    function _fxrpDebtWithFees(Position storage pos) internal view returns (uint256) {
        return _accrueFee(pos.fxrpDebt, pos.fxrpBorrowTimestamp);
    }

    /// @dev Returns (flrTotalDebt, fxrpTotalDebt) with fees.
    function _getDebtWithFees(Position storage pos) internal view returns (uint256 flrTotal, uint256 fxrpTotal) {
        flrTotal  = _flrDebtWithFees(pos);
        fxrpTotal = _fxrpDebtWithFees(pos);
    }

    function _hasValidScore(Position storage pos) internal view returns (bool) {
        return pos.scoreTimestamp != 0
            && block.timestamp <= pos.scoreTimestamp + scoreExpiry;
    }

    function _hasDebt(Position storage pos) internal view returns (bool) {
        return pos.flrDebt > 0 || pos.fxrpDebt > 0;
    }
}
