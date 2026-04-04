// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/SmartAccountReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ---------------------------------------------------------------------------
// Mock ICreditVault
// ---------------------------------------------------------------------------
contract MockCreditVault {
    mapping(address => uint256) public balances;

    function receiveScore(address user, uint256 score, uint256 timestamp, bytes calldata sig) external {}
    function depositFLR() external payable {}
    function depositFXRP(uint256 amount) external {}
    function borrow(address asset, uint256 amount) external {}
    function repay(address asset, uint256 amount) external payable {}
    function withdrawCollateral(address asset, uint256 amount) external {}
    function liquidate(address user) external {}
    function getDebt(address user) external returns (uint256 flrDebt, uint256 fxrpDebt) {}
    function getHealthFactor(address user) external returns (uint256) {}
    function getMaxBorrow(address user, address asset) external returns (uint256) {}
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
// SmartAccountReceiver Tests
// ---------------------------------------------------------------------------
contract SmartAccountReceiverTest is Test {
    SmartAccountReceiver internal receiver;
    MockCreditVault internal vault;
    MockFXRP internal fxrp;

    address internal instructionSender = makeAddr("instructionSender");
    bytes32 internal xrplAddress1 = bytes32(uint256(1));
    bytes32 internal xrplAddress2 = bytes32(uint256(2));

    function setUp() public {
        vault = new MockCreditVault();
        fxrp = new MockFXRP();
        receiver = new SmartAccountReceiver(address(vault), instructionSender, address(fxrp));
    }

    // -----------------------------------------------------------------------
    // Test: Constructor
    // -----------------------------------------------------------------------

    function test_ConstructorSetsCorrectAddresses() public {
        assertEq(address(receiver.vault()), address(vault));
        assertEq(receiver.instructionSender(), instructionSender);
        assertEq(address(receiver.fxrp()), address(fxrp));
    }

    // -----------------------------------------------------------------------
    // Test: XRPL to Flare Address Mapping
    // -----------------------------------------------------------------------

    function test_HandleDepositMapsDifferentXrplAddresses() public {
        // First call with xrplAddress1 should create a mapping
        receiver.handleDeposit(xrplAddress1);
        address mappedAddr1 = receiver.xrplToFlare(xrplAddress1);
        assertNotEq(mappedAddr1, address(0), "Flare address should not be zero");

        // Call again with same address should return same mapping
        receiver.handleDeposit(xrplAddress1);
        address mappedAddr1Again = receiver.xrplToFlare(xrplAddress1);
        assertEq(mappedAddr1, mappedAddr1Again, "Should return same mapped address");

        // Call with xrplAddress2 should create different mapping
        receiver.handleDeposit(xrplAddress2);
        address mappedAddr2 = receiver.xrplToFlare(xrplAddress2);
        assertNotEq(mappedAddr2, address(0), "Flare address should not be zero");
        assertNotEq(mappedAddr1, mappedAddr2, "Different XRPL addresses should map to different Flare addresses");
    }

    function test_GetOrCreateFlareAddressReturnsConsistentMapping() public {
        // First deposit
        receiver.handleDeposit(xrplAddress1);
        address mapped1 = receiver.xrplToFlare(xrplAddress1);

        // Second deposit
        receiver.handleDeposit(xrplAddress1);
        address mapped2 = receiver.xrplToFlare(xrplAddress1);

        // Should be identical
        assertEq(mapped1, mapped2, "Mapping should be deterministic and consistent");
    }

    // -----------------------------------------------------------------------
    // Test: Event Emission
    // -----------------------------------------------------------------------

    function test_HandleDepositEmitsXrplUserMappedEvent() public {
        // XrplUserMapped event is only emitted on first mapping creation
        vm.expectEmit(true, false, false, true);
        // We need to figure out what the mapped address will be in advance
        address expectedMappedAddr = address(uint160(uint256(keccak256(abi.encodePacked(xrplAddress1, address(receiver))))));
        emit SmartAccountReceiver.XrplUserMapped(xrplAddress1, expectedMappedAddr);
        receiver.handleDeposit(xrplAddress1);
    }

    function test_HandleDepositEmitsActionRoutedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "deposit");
        receiver.handleDeposit(xrplAddress1);
    }

    function test_HandleScoreRequestEmitsActionRoutedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "score");
        receiver.handleScoreRequest(xrplAddress1, "");
    }

    function test_HandleBorrowEmitsActionRoutedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "borrow");
        receiver.handleBorrow(xrplAddress1, address(fxrp), 100);
    }

    function test_HandleRepayEmitsActionRoutedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "repay");
        receiver.handleRepay(xrplAddress1, address(fxrp));
    }

    // -----------------------------------------------------------------------
    // Test: Payable Functions Accept ETH
    // -----------------------------------------------------------------------

    function test_HandleDepositAcceptsEth() public {
        uint256 amount = 1 ether;
        receiver.handleDeposit{value: amount}(xrplAddress1);
        // Should not revert
        assertTrue(true);
    }

    function test_HandleScoreRequestAcceptsEth() public {
        uint256 amount = 1 ether;
        receiver.handleScoreRequest{value: amount}(xrplAddress1, "");
        // Should not revert
        assertTrue(true);
    }

    function test_HandleRepayAcceptsEth() public {
        uint256 amount = 1 ether;
        receiver.handleRepay{value: amount}(xrplAddress1, address(fxrp));
        // Should not revert
        assertTrue(true);
    }

    function test_ReceiveFunctionAcceptsEth() public {
        uint256 amount = 1 ether;
        (bool ok,) = address(receiver).call{value: amount}("");
        assertTrue(ok, "receive() should accept ETH");
    }

    // -----------------------------------------------------------------------
    // Test: Multiple Handlers Map Same XRPL Address
    // -----------------------------------------------------------------------

    function test_AllHandlersMapSameXrplAddressConsistently() public {
        // Call different handlers with same XRPL address
        receiver.handleDeposit(xrplAddress1);
        address mappedAfterDeposit = receiver.xrplToFlare(xrplAddress1);

        receiver.handleScoreRequest(xrplAddress1, "");
        address mappedAfterScore = receiver.xrplToFlare(xrplAddress1);

        receiver.handleBorrow(xrplAddress1, address(fxrp), 100);
        address mappedAfterBorrow = receiver.xrplToFlare(xrplAddress1);

        receiver.handleRepay(xrplAddress1, address(fxrp));
        address mappedAfterRepay = receiver.xrplToFlare(xrplAddress1);

        // All should be identical
        assertEq(mappedAfterDeposit, mappedAfterScore);
        assertEq(mappedAfterScore, mappedAfterBorrow);
        assertEq(mappedAfterBorrow, mappedAfterRepay);
    }

    // -----------------------------------------------------------------------
    // Test: Deterministic Address Generation
    // -----------------------------------------------------------------------

    function test_MappedAddressIsDeterministic() public {
        // Deploy a second SmartAccountReceiver with same parameters
        SmartAccountReceiver receiver2 = new SmartAccountReceiver(
            address(vault),
            instructionSender,
            address(fxrp)
        );

        // Call handleDeposit on both with same XRPL address
        receiver.handleDeposit(xrplAddress1);
        receiver2.handleDeposit(xrplAddress1);

        // The mapped addresses might differ because they're hashed with different contract addresses
        // But within the same contract, they should always be the same
        address mapped1 = receiver.xrplToFlare(xrplAddress1);
        address mapped2 = receiver2.xrplToFlare(xrplAddress1);

        // Within same contract, consistency is key
        receiver.handleDeposit(xrplAddress1);
        address mapped1Again = receiver.xrplToFlare(xrplAddress1);
        assertEq(mapped1, mapped1Again, "Same receiver should produce same address");
    }

    // -----------------------------------------------------------------------
    // Test: Non-payable Function (handleBorrow)
    // -----------------------------------------------------------------------

    function test_HandleBorrowCanBeCalledWithoutEth() public {
        // handleBorrow is not payable, but can still be called
        receiver.handleBorrow(xrplAddress1, address(fxrp), 100);
        address mapped = receiver.xrplToFlare(xrplAddress1);
        assertNotEq(mapped, address(0), "handleBorrow should still map XRPL address");
    }
}
