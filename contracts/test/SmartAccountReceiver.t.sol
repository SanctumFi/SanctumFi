// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/SmartAccountReceiver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ---------------------------------------------------------------------------
// Mock ICreditVault — tracks calls for assertions
// ---------------------------------------------------------------------------
contract MockCreditVault {
    // Track depositFLRFor calls
    address public lastDepositUser;
    uint256 public lastDepositAmount;

    // Track borrowFor calls
    address public lastBorrowUser;
    address public lastBorrowAsset;
    uint256 public lastBorrowAmount;

    // Track repayFor calls
    address public lastRepayUser;
    address public lastRepayAsset;
    uint256 public lastRepayValue;

    function depositFLRFor(address user) external payable {
        lastDepositUser = user;
        lastDepositAmount = msg.value;
    }

    function depositFXRPFor(address user, uint256 amount) external {
        lastDepositUser = user;
        lastDepositAmount = amount;
    }

    function borrowFor(address user, address asset, uint256 amount) external {
        lastBorrowUser = user;
        lastBorrowAsset = asset;
        lastBorrowAmount = amount;
        // Simulate sending borrowed FLR back to caller
        if (asset == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok);
        }
    }

    function repayFor(address user, address asset, uint256 amount) external payable {
        lastRepayUser = user;
        lastRepayAsset = asset;
        lastRepayValue = msg.value;
    }

    // Unused ICreditVault functions
    function receiveScore(address, uint256, uint256, bytes calldata) external {}
    function depositFLR() external payable {}
    function depositFXRP(uint256) external {}
    function borrow(address, uint256) external {}
    function repay(address, uint256) external payable {}
    function withdrawCollateral(address, uint256) external {}
    function liquidate(address) external {}
    function getDebt(address) external returns (uint256, uint256) {}
    function getHealthFactor(address) external returns (uint256) {}
    function getMaxBorrow(address, address) external returns (uint256) {}

    receive() external payable {}
}

// ---------------------------------------------------------------------------
// Mock InstructionSender — tracks score requests
// ---------------------------------------------------------------------------
contract MockInstructionSender {
    bytes public lastPayload;
    uint256 public lastValue;

    function requestCreditScore(bytes calldata _encryptedPayload) external payable {
        lastPayload = _encryptedPayload;
        lastValue = msg.value;
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
// SmartAccountReceiver Tests
// ---------------------------------------------------------------------------
contract SmartAccountReceiverTest is Test {
    SmartAccountReceiver internal receiver;
    MockCreditVault internal vault;
    MockInstructionSender internal instrSender;
    MockFXRP internal fxrp;

    bytes32 internal xrplAddress1 = bytes32(uint256(1));
    bytes32 internal xrplAddress2 = bytes32(uint256(2));

    function setUp() public {
        vault = new MockCreditVault();
        instrSender = new MockInstructionSender();
        fxrp = new MockFXRP();
        receiver = new SmartAccountReceiver(address(vault), address(instrSender), address(fxrp));
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    function test_ConstructorSetsCorrectAddresses() public {
        assertEq(address(receiver.vault()), address(vault));
        assertEq(address(receiver.instructionSender()), address(instrSender));
        assertEq(address(receiver.fxrp()), address(fxrp));
    }

    // -----------------------------------------------------------------------
    // Address mapping
    // -----------------------------------------------------------------------

    function test_HandleDepositMapsDifferentXrplAddresses() public {
        receiver.handleDeposit(xrplAddress1);
        address mapped1 = receiver.xrplToFlare(xrplAddress1);
        assertNotEq(mapped1, address(0));

        receiver.handleDeposit(xrplAddress1);
        assertEq(receiver.xrplToFlare(xrplAddress1), mapped1, "Same address, same mapping");

        receiver.handleDeposit(xrplAddress2);
        address mapped2 = receiver.xrplToFlare(xrplAddress2);
        assertNotEq(mapped2, address(0));
        assertNotEq(mapped1, mapped2, "Different XRPL = different Flare");
    }

    function test_AllHandlersMapSameXrplAddressConsistently() public {
        receiver.handleDeposit(xrplAddress1);
        address a = receiver.xrplToFlare(xrplAddress1);

        receiver.handleScoreRequest(xrplAddress1, "");
        assertEq(receiver.xrplToFlare(xrplAddress1), a);

        receiver.handleBorrow(xrplAddress1, address(0), 0);
        assertEq(receiver.xrplToFlare(xrplAddress1), a);

        receiver.handleRepay(xrplAddress1, address(0));
        assertEq(receiver.xrplToFlare(xrplAddress1), a);
    }

    function test_MappedAddressIsDeterministic() public {
        address expected = address(uint160(uint256(keccak256(abi.encodePacked(xrplAddress1, address(receiver))))));
        receiver.handleDeposit(xrplAddress1);
        assertEq(receiver.xrplToFlare(xrplAddress1), expected);
    }

    // -----------------------------------------------------------------------
    // handleDeposit — forwards FLR to vault.depositFLRFor
    // -----------------------------------------------------------------------

    function test_HandleDepositForwardsFLRToVault() public {
        uint256 amount = 5 ether;
        receiver.handleDeposit{value: amount}(xrplAddress1);

        address expectedUser = receiver.xrplToFlare(xrplAddress1);
        assertEq(vault.lastDepositUser(), expectedUser);
        assertEq(vault.lastDepositAmount(), amount);
        assertEq(address(vault).balance, amount, "Vault should hold the FLR");
    }

    function test_HandleDepositEmitsEvents() public {
        address expectedAddr = address(uint160(uint256(keccak256(abi.encodePacked(xrplAddress1, address(receiver))))));

        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.XrplUserMapped(xrplAddress1, expectedAddr);
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "deposit");

        receiver.handleDeposit{value: 1 ether}(xrplAddress1);
    }

    // -----------------------------------------------------------------------
    // handleScoreRequest — forwards to InstructionSender
    // -----------------------------------------------------------------------

    function test_HandleScoreRequestCallsInstructionSender() public {
        bytes memory payload = abi.encodePacked("encrypted_plaid_token");
        uint256 fee = 0.001 ether;

        receiver.handleScoreRequest{value: fee}(xrplAddress1, payload);

        assertEq(instrSender.lastPayload(), payload);
        assertEq(instrSender.lastValue(), fee);
    }

    function test_HandleScoreRequestEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "score");
        receiver.handleScoreRequest(xrplAddress1, "");
    }

    // -----------------------------------------------------------------------
    // handleBorrow — calls vault.borrowFor, tracks received funds
    // -----------------------------------------------------------------------

    function test_HandleBorrowCallsVaultAndTracksFunds() public {
        uint256 borrowAmt = 2 ether;
        // Fund the mock vault so it can send FLR back
        vm.deal(address(vault), 10 ether);

        // First deposit to create the mapping
        receiver.handleDeposit(xrplAddress1);
        address user = receiver.xrplToFlare(xrplAddress1);

        receiver.handleBorrow(xrplAddress1, address(0), borrowAmt);

        assertEq(vault.lastBorrowUser(), user);
        assertEq(vault.lastBorrowAsset(), address(0));
        assertEq(vault.lastBorrowAmount(), borrowAmt);
        assertEq(receiver.borrowedFLR(user), borrowAmt);
    }

    function test_HandleBorrowEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "borrow");
        receiver.handleBorrow(xrplAddress1, address(0), 0);
    }

    // -----------------------------------------------------------------------
    // handleRepay — forwards FLR to vault.repayFor
    // -----------------------------------------------------------------------

    function test_HandleRepayForwardsFLRToVault() public {
        uint256 repayAmt = 1 ether;

        receiver.handleDeposit(xrplAddress1);
        address user = receiver.xrplToFlare(xrplAddress1);

        receiver.handleRepay{value: repayAmt}(xrplAddress1, address(0));

        assertEq(vault.lastRepayUser(), user);
        assertEq(vault.lastRepayAsset(), address(0));
        assertEq(vault.lastRepayValue(), repayAmt);
    }

    function test_HandleRepayEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SmartAccountReceiver.ActionRouted(xrplAddress1, "repay");
        receiver.handleRepay(xrplAddress1, address(0));
    }

    // -----------------------------------------------------------------------
    // receive()
    // -----------------------------------------------------------------------

    function test_ReceiveFunctionAcceptsEth() public {
        (bool ok,) = address(receiver).call{value: 1 ether}("");
        assertTrue(ok, "receive() should accept ETH");
    }
}
