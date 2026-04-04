// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFtsoV2.sol";

/// @title CreditVault — TEE credit-scored lending engine for FlareScore
contract CreditVault is Ownable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes21 public constant FLR_USD_FEED_ID = bytes21(0x01464c522f55534400000000000000000000000000);
    bytes21 public constant XRP_USD_FEED_ID = bytes21(0x015852502f55534400000000000000000000000000);

    uint256 public constant FEE_RATE            = 500;    // 5% APR in basis points
    uint256 public constant LIQUIDATION_DISCOUNT = 500;   // 5% in basis points (unused in simple seize model)
    uint256 public constant BASIS_POINTS        = 10_000;

    // LTV caps (basis points of collateral that can be borrowed)
    uint256 public constant PLATINUM_LTV = 8_000;  // 80%  — score 800-1000
    uint256 public constant GOLD_LTV     = 12_000; // 120% — score 600-799
    uint256 public constant SILVER_LTV   = 15_000; // 150% — score 400-599
    uint256 public constant BRONZE_LTV   = 20_000; // 200% — score 0-399

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
    address  public immutable teeSigner;
    uint256  public immutable scoreExpiry;

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
    // Receive
    // -------------------------------------------------------------------------

    receive() external payable {}

    // -------------------------------------------------------------------------
    // Pool funding (owner only)
    // -------------------------------------------------------------------------

    function fundPoolFLR() external payable onlyOwner {}

    function fundPoolFXRP(uint256 amount) external onlyOwner {
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
    }

    // -------------------------------------------------------------------------
    // Task 2 — Score storage + collateral deposits
    // -------------------------------------------------------------------------

    /// @notice Called by TEE signer to store an attested credit score for a user.
    function receiveScore(
        address user,
        uint256 score,
        uint256 timestamp,
        bytes calldata /* sig */
    ) external {
        require(msg.sender == teeSigner, "CreditVault: not tee signer");
        require(score <= 1000, "CreditVault: score out of range");

        positions[user].creditScore     = score;
        positions[user].scoreTimestamp  = timestamp;

        emit ScoreReceived(user, score, timestamp);
    }

    /// @notice Deposit native FLR as collateral.
    function depositFLR() external payable {
        positions[msg.sender].flrCollateral += msg.value;
        emit CollateralDeposited(msg.sender, address(0), msg.value);
    }

    /// @notice Deposit FXRP ERC-20 as collateral.
    function depositFXRP(uint256 amount) external {
        fxrp.safeTransferFrom(msg.sender, address(this), amount);
        positions[msg.sender].fxrpCollateral += amount;
        emit CollateralDeposited(msg.sender, address(fxrp), amount);
    }

    /// @notice Returns LTV cap (in basis points) for a given credit score.
    function getLtvBps(uint256 score) public pure returns (uint256) {
        if (score >= 800) return PLATINUM_LTV;
        if (score >= 600) return GOLD_LTV;
        if (score >= 400) return SILVER_LTV;
        return BRONZE_LTV;
    }

    // -------------------------------------------------------------------------
    // Task 3 — Borrow, repay, liquidate
    // -------------------------------------------------------------------------

    /// @notice Borrow FLR (asset == address(0)) or FXRP (asset == fxrp address).
    function borrow(address asset, uint256 amount) external {
        Position storage pos = positions[msg.sender];

        require(_hasValidScore(pos), "CreditVault: no valid score");
        require(amount > 0, "CreditVault: zero amount");

        // Apply new debt tentatively to check LTV.
        if (asset == address(0)) {
            pos.flrDebt += amount;
            if (pos.flrBorrowTimestamp == 0) pos.flrBorrowTimestamp = block.timestamp;
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            pos.fxrpDebt += amount;
            if (pos.fxrpBorrowTimestamp == 0) pos.fxrpBorrowTimestamp = block.timestamp;
        }

        uint256 colUSD  = _collateralValueUSD(pos);
        uint256 debtUSD = _debtValueUSD(pos);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // debtUSD / collateralUSD <= ltvBps / BASIS_POINTS
        require(debtUSD * BASIS_POINTS <= colUSD * ltvBps, "CreditVault: exceeds LTV");

        // Transfer asset to borrower.
        if (asset == address(0)) {
            require(address(this).balance >= amount, "CreditVault: insufficient pool FLR");
            // Re-check: balance includes collateral so we track separately via accounting.
            // Safe because flrCollateral is recorded independently.
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "CreditVault: FLR transfer failed");
        } else {
            fxrp.safeTransfer(msg.sender, amount);
        }

        emit Borrowed(msg.sender, asset, amount);
    }

    /// @notice Repay debt. For FLR send msg.value; for FXRP set amount and approve first.
    function repay(address asset, uint256 amount) external payable {
        Position storage pos = positions[msg.sender];

        if (asset == address(0)) {
            require(pos.flrDebt > 0, "CreditVault: no FLR debt");
            uint256 totalOwed = _flrDebtWithFees(pos);

            uint256 payment = msg.value;
            if (payment > totalOwed) {
                // Refund excess.
                uint256 refund = payment - totalOwed;
                payment = totalOwed;
                (bool ok,) = msg.sender.call{value: refund}("");
                require(ok, "CreditVault: refund failed");
            }

            // Clear or reduce debt proportionally (simple: payment clears principal first).
            if (payment >= totalOwed) {
                pos.flrDebt = 0;
                pos.flrBorrowTimestamp = 0;
            } else {
                // Partial: reduce principal by (payment / totalOwed) * principal.
                pos.flrDebt = pos.flrDebt - (pos.flrDebt * payment / totalOwed);
                pos.flrBorrowTimestamp = block.timestamp;
            }

            emit Repaid(msg.sender, asset, payment);
        } else {
            require(asset == address(fxrp), "CreditVault: unknown asset");
            require(pos.fxrpDebt > 0, "CreditVault: no FXRP debt");

            uint256 totalOwed = _fxrpDebtWithFees(pos);
            uint256 payment   = amount > totalOwed ? totalOwed : amount;

            fxrp.safeTransferFrom(msg.sender, address(this), payment);

            if (payment >= totalOwed) {
                pos.fxrpDebt = 0;
                pos.fxrpBorrowTimestamp = 0;
            } else {
                pos.fxrpDebt = pos.fxrpDebt - (pos.fxrpDebt * payment / totalOwed);
                pos.fxrpBorrowTimestamp = block.timestamp;
            }

            emit Repaid(msg.sender, asset, payment);
        }
    }

    /// @notice Withdraw collateral as long as the position remains healthy.
    function withdrawCollateral(address asset, uint256 amount) external {
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
        uint256 debtUSD = _debtValueUSD(pos);
        if (debtUSD > 0) {
            uint256 colUSD = _collateralValueUSD(pos);
            uint256 ltvBps = getLtvBps(pos.creditScore);
            require(debtUSD * BASIS_POINTS <= colUSD * ltvBps, "CreditVault: would breach LTV");
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
    function liquidate(address user) external {
        Position storage pos = positions[user];

        require(_hasDebt(pos), "CreditVault: no debt");
        require(getHealthFactor(user) < HEALTH_PRECISION, "CreditVault: position healthy");

        uint256 flrCol  = pos.flrCollateral;
        uint256 fxrpCol = pos.fxrpCollateral;

        // Clear position.
        pos.flrCollateral       = 0;
        pos.fxrpCollateral      = 0;
        pos.flrDebt             = 0;
        pos.fxrpDebt            = 0;
        pos.flrBorrowTimestamp  = 0;
        pos.fxrpBorrowTimestamp = 0;

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
    /// @dev    Not view because FTSO getFeedById is payable (but no ETH is consumed here).
    function getDebt(address user) external returns (uint256 flrDebt, uint256 fxrpDebt) {
        Position storage pos = positions[user];
        flrDebt  = _flrDebtWithFees(pos);
        fxrpDebt = _fxrpDebtWithFees(pos);
    }

    /// @notice Returns health factor scaled by HEALTH_PRECISION (1e18 = 1.0 — minimum healthy).
    /// @dev    Not view because FTSO getFeedById is payable (but no ETH is consumed here).
    function getHealthFactor(address user) public returns (uint256) {
        Position storage pos = positions[user];
        uint256 debtUSD = _debtValueUSD(pos);
        if (debtUSD == 0) return type(uint256).max;

        uint256 ltvBps  = getLtvBps(pos.creditScore);
        uint256 colUSD  = _collateralValueUSD(pos);

        // health = (collateralUSD * ltvBps) / (debtUSD * BASIS_POINTS)
        // < 1.0 (scaled) means position is liquidatable
        return (colUSD * ltvBps * HEALTH_PRECISION) / (debtUSD * BASIS_POINTS);
    }

    /// @notice Returns how much more of `asset` the user can borrow given current collateral.
    /// @dev    Not view because FTSO getFeedById is payable (but no ETH is consumed here).
    function getMaxBorrow(address user, address asset) external returns (uint256) {
        Position storage pos = positions[user];
        if (!_hasValidScore(pos)) return 0;

        uint256 colUSD  = _collateralValueUSD(pos);
        uint256 debtUSD = _debtValueUSD(pos);
        uint256 ltvBps  = getLtvBps(pos.creditScore);

        // maxDebtUSD = collateralUSD * ltvBps / BASIS_POINTS  (same as borrow cap)
        uint256 maxDebtUSD = colUSD * ltvBps / BASIS_POINTS;
        if (maxDebtUSD <= debtUSD) return 0;

        uint256 remainingUSD = maxDebtUSD - debtUSD;

        // Convert remainingUSD back to asset units.
        if (asset == address(0)) {
            (uint256 price, int8 dec,) = _getFlrPriceUSD();
            return _fromUSD(remainingUSD, price, dec);
        } else {
            (uint256 price, int8 dec,) = _getXrpPriceUSD();
            return _fromUSD(remainingUSD, price, dec);
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _getFlrPriceUSD() internal returns (uint256 price, int8 dec, uint64 ts) {
        (price, dec, ts) = ftsoV2.getFeedById(FLR_USD_FEED_ID);
    }

    function _getXrpPriceUSD() internal returns (uint256 price, int8 dec, uint64 ts) {
        (price, dec, ts) = ftsoV2.getFeedById(XRP_USD_FEED_ID);
    }

    /// @dev Normalize an asset amount to 18-decimal USD value.
    ///      `dec` is the decimal count of the FTSO price (e.g. 18 → price in 1e-18 USD per unit).
    function _toUSD(uint256 amount, uint256 price, int8 dec) internal pure returns (uint256) {
        // USD = amount * price / 10^dec
        // We work in 1e18 precision throughout.
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

    function _collateralValueUSD(Position storage pos) internal returns (uint256) {
        (uint256 flrPrice, int8 flrDec,) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec,) = _getXrpPriceUSD();
        return _toUSD(pos.flrCollateral, flrPrice, flrDec)
             + _toUSD(pos.fxrpCollateral, xrpPrice, xrpDec);
    }

    function _debtValueUSD(Position storage pos) internal returns (uint256) {
        (uint256 flrPrice, int8 flrDec,) = _getFlrPriceUSD();
        (uint256 xrpPrice, int8 xrpDec,) = _getXrpPriceUSD();
        return _toUSD(_flrDebtWithFees(pos), flrPrice, flrDec)
             + _toUSD(_fxrpDebtWithFees(pos), xrpPrice, xrpDec);
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

    function _hasValidScore(Position storage pos) internal view returns (bool) {
        return pos.scoreTimestamp != 0
            && block.timestamp <= pos.scoreTimestamp + scoreExpiry;
    }

    function _hasDebt(Position storage pos) internal view returns (bool) {
        return pos.flrDebt > 0 || pos.fxrpDebt > 0;
    }
}
