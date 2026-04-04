// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/CreditVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ---------------------------------------------------------------------------
// Mock FTSO V2 — returns $0.03 (3e16 with 18 decimals) for any feed.
// ---------------------------------------------------------------------------
contract MockFtsoV2 {
    function getFeedById(bytes21 /* feedId */)
        external
        view
        returns (uint256 value, int8 decimals, uint64 timestamp)
    {
        value     = 3e16;        // $0.03
        decimals  = 18;
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
    address internal teeSigner  = makeAddr("teeSigner");
    address internal alice      = makeAddr("alice");
    address internal bob        = makeAddr("bob");
    address internal liquidator = makeAddr("liquidator");

    uint256 internal constant SCORE_EXPIRY = 30 days;

    function setUp() public {
        ftso  = new MockFtsoV2();
        fxrp  = new MockFXRP();
        vault = new CreditVault(
            address(ftso),
            address(fxrp),
            teeSigner,
            SCORE_EXPIRY
        );

        // Fund protocol pool with FLR so borrows succeed.
        vm.deal(address(vault), 1_000_000 ether);

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
    // Helper functions
    // -------------------------------------------------------------------------

    function _giveScore(address user, uint256 score) internal {
        vm.prank(teeSigner);
        vault.receiveScore(user, score, block.timestamp, "");
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
    // Task 2 — Score storage + collateral deposits
    // =========================================================================

    function test_receiveScore_storesScore() public {
        uint256 score = 750;
        uint256 ts    = block.timestamp;

        vm.prank(teeSigner);
        vault.receiveScore(alice, score, ts, "");

        assertEq(_creditScore(alice),    score);
        assertEq(_scoreTimestamp(alice), ts);
    }

    function test_receiveScore_rejectsNonTee() public {
        vm.prank(alice);
        vm.expectRevert("CreditVault: not tee signer");
        vault.receiveScore(alice, 750, block.timestamp, "");
    }

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
    // Task 3 — Borrow, repay, liquidate
    // =========================================================================

    /// Platinum (score=900): LTV 80%.
    /// deposit 10_000 FLR, borrow 7_000 FLR (within 80% of 10_000).
    function test_borrow_FLR_withinLTV() public {
        _giveScore(alice, 900);

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 borrowAmount = 7_000 ether;
        uint256 balBefore    = alice.balance;

        vm.prank(alice);
        vault.borrow(address(0), borrowAmount);

        assertEq(alice.balance - balBefore, borrowAmount);

        (uint256 flrDebt,) = vault.getDebt(alice);
        assertEq(flrDebt, borrowAmount);
    }

    function test_borrow_reverts_exceedsLTV() public {
        _giveScore(alice, 900); // Platinum 80% LTV

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        // Max borrow = 8_000 FLR (80% of 10_000); try 9_000.
        vm.prank(alice);
        vm.expectRevert("CreditVault: exceeds LTV");
        vault.borrow(address(0), 9_000 ether);
    }

    function test_borrow_reverts_noScore() public {
        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vm.expectRevert("CreditVault: no valid score");
        vault.borrow(address(0), 100 ether);
    }

    function test_repay_FLR() public {
        _giveScore(alice, 900);

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        uint256 borrowAmount = 5_000 ether;
        vm.prank(alice);
        vault.borrow(address(0), borrowAmount);

        // Repay immediately (no time elapsed so fees == 0 at instantaneous borrow).
        (uint256 debtBefore,) = vault.getDebt(alice);
        assertEq(debtBefore, borrowAmount);

        vm.prank(alice);
        vault.repay{value: borrowAmount}(address(0), 0);

        (uint256 debtAfter,) = vault.getDebt(alice);
        assertEq(debtAfter, 0);
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

    /// Bronze score (0-399) → 200% LTV.
    /// deposit 10_000 FLR, borrow 20_000 FLR (right at 200% LTV).
    /// After 1 year at 5% APR: debt = 21_000 FLR → debtUSD > colUSD → unhealthy.
    function test_liquidate_unhealthyPosition() public {
        _giveScore(bob, 300); // Bronze 200% LTV

        vm.prank(bob);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(bob);
        vault.borrow(address(0), 20_000 ether);

        // Warp 1 year.
        vm.warp(block.timestamp + 365 days);

        // Verify unhealthy.
        uint256 hf = vault.getHealthFactor(bob);
        assertLt(hf, 1e18, "position should be unhealthy");

        uint256 liqBalBefore = liquidator.balance;

        vm.prank(liquidator);
        vault.liquidate(bob);

        assertGt(liquidator.balance - liqBalBefore, 0, "liquidator should receive FLR collateral");

        (uint256 flrDebt,) = vault.getDebt(bob);
        assertEq(flrDebt, 0, "bob debt should be cleared");
    }

    /// Platinum (80% LTV), deposit 10_000 FLR, borrow 4_000 FLR.
    /// debtUSD = 4_000 * 0.03 = $120.
    /// minColUSD = debtUSD * BASIS_POINTS / ltvBps = 120 * 10000 / 8000 = $150.
    /// minColFLR = 150 / 0.03 = 5_000 FLR → can safely withdraw up to 5_000 FLR.
    function test_withdrawCollateral_excessOnly() public {
        _giveScore(alice, 900);

        vm.prank(alice);
        vault.depositFLR{value: 10_000 ether}();

        vm.prank(alice);
        vault.borrow(address(0), 4_000 ether);

        // Withdraw 4_000 FLR — safe (leaves 6_000 FLR = $180 > $150 min).
        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        vault.withdrawCollateral(address(0), 4_000 ether);
        assertEq(alice.balance - aliceBalBefore, 4_000 ether);

        // Try to withdraw 1_500 more — would leave only 4_500 FLR = $135 < $150 min, breaching LTV.
        vm.prank(alice);
        vm.expectRevert("CreditVault: would breach LTV");
        vault.withdrawCollateral(address(0), 1_500 ether);
    }
}
