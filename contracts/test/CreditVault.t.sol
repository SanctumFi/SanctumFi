// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/CreditVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ---------------------------------------------------------------------------
// Mock FTSO V2 — returns a configurable price per feed.
// ---------------------------------------------------------------------------
contract MockFtsoV2 {
    uint256 public price    = 3e16;   // default $0.03
    int8    public decimals = 18;

    function setPrice(uint256 _price) external { price = _price; }

    function getFeedById(bytes21 /* feedId */)
        external
        view
        returns (uint256 value, int8 dec, uint64 timestamp)
    {
        value     = price;
        dec       = decimals;
        timestamp = uint64(block.timestamp);
    }
}

// ---------------------------------------------------------------------------
// Mock FXRP ERC-20
// ---------------------------------------------------------------------------
contract MockFXRP is ERC20 {
    constructor() ERC20("Flare XRP", "FXRP") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ---------------------------------------------------------------------------
// CreditVault Tests
// ---------------------------------------------------------------------------
contract CreditVaultTest is Test {
    CreditVault internal vault;
    MockFtsoV2  internal ftso;
    MockFXRP    internal fxrp;

    address internal owner      = address(this);
    address internal alice      = makeAddr("alice");
    address internal bob        = makeAddr("bob");
    address internal liquidator = makeAddr("liquidator");

    // TEE signer key pair — use a known private key so we can sign in tests.
    uint256 internal constant TEE_PRIVATE_KEY = 0xBEEF;
    address internal teeSigner;

    uint256 internal constant SCORE_EXPIRY = 30 days;

    function setUp() public {
        teeSigner = vm.addr(TEE_PRIVATE_KEY);

        ftso  = new MockFtsoV2();
        fxrp  = new MockFXRP();
        vault = new CreditVault(
            address(ftso),
            address(fxrp),
            teeSigner,
            SCORE_EXPIRY
        );

        // Fund protocol pool with FLR so borrows succeed.
        vault.fundPoolFLR{value: 1_000_000 ether}();

        // Fund pool with FXRP.
        fxrp.mint(owner, 1_000_000 ether);
        fxrp.approve(address(vault), type(uint256).max);
        vault.fundPoolFXRP(1_000_000 ether);

        // Give alice and bob some ETH and FXRP.
        vm.deal(alice, 100_000 ether);
        vm.deal(bob,   100_000 ether);
        fxrp.mint(alice, 100_000 ether);
        fxrp.mint(bob,   100_000 ether);
    }

    // -------------------------------------------------------------------------
    // Helper: sign a score with the TEE private key.
    // -------------------------------------------------------------------------

    function _signScore(address user, uint256 score, uint256 timestamp)
        internal
        view
        returns (bytes memory sig)
    {
        bytes32 messageHash   = keccak256(abi.encodePacked(user, score, timestamp));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TEE_PRIVATE_KEY, ethSignedHash);
        sig = abi.encodePacked(r, s, v);
    }

    function _giveScore(address user, uint256 score) internal {
        uint256 ts  = block.timestamp;
        bytes memory sig = _signScore(user, score, ts);
        vault.receiveScore(user, score, ts, sig);
    }

    function _approveVault(address user) internal {
        vm.prank(user);
        fxrp.approve(address(vault), type(uint256).max);
    }

    function _creditScore(address user) internal view returns (uint256) {
        (uint256 s,,,,,,,) = vault.positions(user);
        return s;
    }

    function _scoreTimestamp(address user) internal view returns (uint256) {
        (, uint256 ts,,,,,,) = vault.positions(user);
        return ts;
    }

    function _flrCollateral(address user) internal view returns (uint256) {
        (,, uint256 c,,,,,) = vault.positions(user);
        return c;
    }

    function _fxrpCollateral(address user) internal view returns (uint256) {
        (,,, uint256 c,,,,) = vault.positions(user);
        return c;
    }

    // =========================================================================
    // Score storage tests
    // =========================================================================

    function test_receiveScore_storesScore() public {
        uint256 score = 750;
        uint256 ts    = block.timestamp;
        bytes memory sig = _signScore(alice, score, ts);

        vault.receiveScore(alice, score, ts, sig);

        assertEq(_creditScore(alice),    score);
        assertEq(_scoreTimestamp(alice), ts);
    }

    function test_receiveScore_rejectsInvalidSignature() public {
        // Sign with a DIFFERENT key — should revert.
        bytes32 msgHash = keccak256(abi.encodePacked(alice, uint256(750), block.timestamp));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEAD, ethHash); // wrong key
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert("CreditVault: invalid TEE signature");
        vault.receiveScore(alice, 750, block.timestamp, badSig);
    }

    function test_receiveScore_rejectsFutureTimestamp() public {
        uint256 futureTs = block.timestamp + 1 hours;
        bytes memory sig = _signScore(alice, 750, futureTs);

        vm.expectRevert("CreditVault: future timestamp");
        vault.receiveScore(alice, 750, futureTs, sig);
    }

    function test_receiveScore_rejectsStaleTimestamp() public {
        // Warp forward; the score timestamp is now > 1 hour old.
        uint256 oldTs = block.timestamp;
        bytes memory sig = _signScore(alice, 750, oldTs);

        vm.warp(block.timestamp + 2 hours);

        vm.expectRevert("CreditVault: score too old");
        vault.receiveScore(alice, 750, oldTs, sig);
    }

    function test_receiveScore_rejectsScoreAbove1000() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _signScore(alice, 1001, ts);

        vm.expectRevert("CreditVault: score out of range");
        vault.receiveScore(alice, 1001, ts, sig);
    }

    // =========================================================================
    // Collateral deposit tests
    // =========================================================================

    function test_depositFLR() public {
        uint256 amount = 100 ether;
        vm.prank(alice);
        vault.depositFLR{value: amount}();

        assertEq(_flrCollateral(alice), amount);
    }

    function test_depositFXRP() public {
        uint256 amount = 500 ether;
        _approveVault(alice);

        vm.prank(alice);
        vault.depositFXRP(amount);

        assertEq(_fxrpCollateral(alice), amount);
    }

    // =========================================================================
    // Pool accounting tests
    // =========================================================================

    function test_poolFLR_trackedOnFund() public {
        uint256 before = vault.poolFLR();
        vault.fundPoolFLR{value: 500 ether}();
        assertEq(vault.poolFLR(), before + 500 ether);
    }

    function test_poolFLR_decreasesOnBorrow() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 poolBefore = vault.poolFLR();
        vm.prank(alice);
        vault.borrow(address(0), 5_000 ether);

        assertEq(vault.poolFLR(), poolBefore - 5_000 ether);
    }

    function test_poolFLR_increasesOnRepay() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 5_000 ether);

        uint256 poolAfterBorrow = vault.poolFLR();

        vm.prank(alice);
        vault.repay{value: 5_000 ether}(address(0), 0);

        assertGe(vault.poolFLR(), poolAfterBorrow + 5_000 ether);
    }

    // =========================================================================
    // Borrow / LTV tests
    // =========================================================================

    // Platinum (score=900): collateral ratio 80%.
    // Can borrow up to col * BASIS_POINTS / ltvBps = col * 10000 / 8000 = col * 1.25
    // deposit 10_000 FLR → can borrow up to 12_500 FLR; borrow 12_000 (within limit).
    function test_borrow_FLR_platinum_withinLTV() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 borrowAmount = 12_000 ether; // 120% of collateral < 125% max
        uint256 balBefore    = alice.balance;

        vm.prank(alice);
        vault.borrow(address(0), borrowAmount);

        assertEq(alice.balance - balBefore, borrowAmount);

        (uint256 flrDebt,) = vault.getDebt(alice);
        assertEq(flrDebt, borrowAmount);
    }

    // Platinum: try to borrow 13_000 FLR > 12_500 max — should revert.
    function test_borrow_reverts_platinum_exceedsLTV() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vm.expectRevert("CreditVault: exceeds LTV");
        vault.borrow(address(0), 13_000 ether);
    }

    // Gold (score=700): collateral ratio 120%.
    // deposit 10_000 FLR → max borrow = 10_000 * 10000 / 12000 ≈ 8_333 FLR.
    // Borrow 8_000 FLR (within limit).
    function test_borrow_FLR_gold_withinLTV() public {
        _giveScore(alice, 700);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        vault.borrow(address(0), 8_000 ether);

        assertEq(alice.balance - balBefore, 8_000 ether);
    }

    // Gold: borrow 9_000 > 8_333 max — should revert.
    function test_borrow_reverts_gold_exceedsLTV() public {
        _giveScore(alice, 700);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vm.expectRevert("CreditVault: exceeds LTV");
        vault.borrow(address(0), 9_000 ether);
    }

    // Bronze (score=300): collateral ratio 200%.
    // deposit 10_000 FLR → max borrow = 10_000 * 10000 / 20000 = 5_000 FLR.
    // Borrow 5_000 FLR (at limit).
    function test_borrow_FLR_bronze_atLimit() public {
        _giveScore(bob, 300);
        vm.prank(bob);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(bob);
        vault.borrow(address(0), 5_000 ether);

        (uint256 flrDebt,) = vault.getDebt(bob);
        assertEq(flrDebt, 5_000 ether);
    }

    // Bronze: borrow 5_001 > 5_000 max — should revert.
    function test_borrow_reverts_bronze_exceedsLTV() public {
        _giveScore(bob, 300);
        vm.prank(bob);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(bob);
        vm.expectRevert("CreditVault: exceeds LTV");
        vault.borrow(address(0), 5_001 ether);
    }

    function test_borrow_reverts_noScore() public {
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vm.expectRevert("CreditVault: no valid score");
        vault.borrow(address(0), 100 ether);
    }

    // =========================================================================
    // Repay tests
    // =========================================================================

    function test_repay_FLR_fullRepay() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 borrowAmount = 5_000 ether;
        vm.prank(alice);
        vault.borrow(address(0), borrowAmount);

        // Repay immediately (no time elapsed so fees ≈ 0).
        (uint256 debtBefore,) = vault.getDebt(alice);
        assertEq(debtBefore, borrowAmount);

        vm.prank(alice);
        vault.repay{value: borrowAmount}(address(0), 0);

        (uint256 debtAfter,) = vault.getDebt(alice);
        assertEq(debtAfter, 0);
    }

    function test_repay_FLR_refundsExcess() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 1_000 ether);

        uint256 balBefore = alice.balance;
        // Send 2_000 but only owe 1_000.
        vm.prank(alice);
        vault.repay{value: 2_000 ether}(address(0), 0);

        // Should get back ~1_000 (excess).
        assertApproxEqAbs(alice.balance, balBefore - 1_000 ether, 1e15);
    }

    function test_repay_FLR_partial() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 4_000 ether);

        // Repay half the principal.
        vm.prank(alice);
        vault.repay{value: 2_000 ether}(address(0), 0);

        (uint256 debtAfter,) = vault.getDebt(alice);
        assertEq(debtAfter, 2_000 ether);
    }

    function test_getDebt_accruesFees() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 borrowAmount = 5_000 ether;
        vm.prank(alice);
        vault.borrow(address(0), borrowAmount);

        // Warp exactly 1 year.
        vm.warp(block.timestamp + 365 days);

        (uint256 flrDebt,) = vault.getDebt(alice);

        // Expected: principal + 5% = 5_000 * 1.05 = 5_250 ether.
        uint256 expected = borrowAmount
            + (borrowAmount * 500 * 365 days) / (10_000 * uint256(365 days));
        assertEq(flrDebt, expected);
    }

    // =========================================================================
    // Health factor and liquidation tests
    // =========================================================================

    // Bronze (score=300): collateral ratio 200%.
    // Deposit 10_000 FLR, borrow max 5_000 FLR.
    // After 1 year at 5% APR: debt = 5_250 FLR.
    // Health = col * BASIS_POINTS / (debt * ltvBps) = 10_000 * 10_000 / (5_250 * 20_000) < 1 → unhealthy.
    function test_liquidate_unhealthyPosition() public {
        _giveScore(bob, 300); // Bronze 200% collateral ratio

        vm.prank(bob);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(bob);
        vault.borrow(address(0), 5_000 ether);

        // Warp 1 year — fees push debt to 5_250 FLR which breaches the 200% ratio.
        vm.warp(block.timestamp + 365 days);

        // Verify unhealthy.
        uint256 hf = vault.getHealthFactor(bob);
        assertLt(hf, 1e18, "position should be unhealthy after fee accrual");

        uint256 liqBalBefore = liquidator.balance;

        vm.prank(liquidator);
        vault.liquidate(bob);

        assertGt(liquidator.balance - liqBalBefore, 0, "liquidator should receive FLR collateral");

        (uint256 flrDebt,) = vault.getDebt(bob);
        assertEq(flrDebt, 0, "bob debt should be cleared");
    }

    function test_liquidate_reverts_healthyPosition() public {
        _giveScore(alice, 900); // Platinum — generous ratio

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 5_000 ether); // well within limit

        vm.prank(liquidator);
        vm.expectRevert("CreditVault: position healthy");
        vault.liquidate(alice);
    }

    // =========================================================================
    // Withdraw collateral tests
    // =========================================================================

    // Platinum (80% ratio): deposit 10_000 FLR, borrow 4_000 FLR.
    // debtUSD = 4_000 * 0.03 = $120.
    // minColUSD = debtUSD * ltvBps / BASIS_POINTS = 120 * 8000 / 10000 = $96.
    // minColFLR = 96 / 0.03 = 3_200 FLR.
    // Can safely withdraw up to 10_000 - 3_200 = 6_800 FLR.
    function test_withdrawCollateral_excessOnly() public {
        _giveScore(alice, 900);

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 4_000 ether);

        // Withdraw 6_500 FLR — safe (leaves 3_500 FLR = $105 >= $96 min).
        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        vault.withdrawCollateral(address(0), 6_500 ether);
        assertEq(alice.balance - aliceBalBefore, 6_500 ether);

        // Try to withdraw 500 more — would leave only 3_000 FLR = $90 < $96 min.
        vm.prank(alice);
        vm.expectRevert("CreditVault: would breach LTV");
        vault.withdrawCollateral(address(0), 500 ether);
    }

    // =========================================================================
    // Zero-price guard tests
    // =========================================================================

    function test_borrow_reverts_zeroFlrPrice() public {
        ftso.setPrice(0);

        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vm.expectRevert("CreditVault: invalid FLR price");
        vault.borrow(address(0), 100 ether);
    }

    // =========================================================================
    // getMaxBorrow tests
    // =========================================================================

    // Platinum: deposit 10_000 FLR, no debt.
    // maxBorrow = 10_000 * 10_000 / 8_000 = 12_500 FLR.
    function test_getMaxBorrow_platinum_noDebt() public {
        _giveScore(alice, 900);
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 max = vault.getMaxBorrow(alice, address(0));
        assertEq(max, 12_500 ether);
    }

    // Bronze: deposit 10_000 FLR, no debt.
    // maxBorrow = 10_000 * 10_000 / 20_000 = 5_000 FLR.
    function test_getMaxBorrow_bronze_noDebt() public {
        _giveScore(bob, 300);
        vm.prank(bob);
        vault.depositFLR{value: 10_000 ether}();

        uint256 max = vault.getMaxBorrow(bob, address(0));
        assertEq(max, 5_000 ether);
    }
}
