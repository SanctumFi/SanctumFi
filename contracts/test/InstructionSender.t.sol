// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/InstructionSender.sol";
import "../src/interfaces/ITeeExtensionRegistry.sol";
import "../src/interfaces/ITeeMachineRegistry.sol";

// ---------------------------------------------------------------------------
// Mock TEE Extension Registry
// ---------------------------------------------------------------------------
contract MockTeeExtensionRegistry {
    event InstructionsSent(
        address[] teeIds,
        bytes32 opType,
        bytes32 opCommand,
        address claimBackAddress
    );

    address public instructionsSender;
    uint256 public counter;

    function register(address _sender) external {
        counter++;
        instructionsSender = _sender;
    }

    function sendInstructions(
        address[] memory _teeIds,
        TeeInstructionParams memory _params
    ) external payable returns (bytes32) {
        emit InstructionsSent(
            _teeIds,
            _params.opType,
            _params.opCommand,
            _params.claimBackAddress
        );
        return keccak256(abi.encodePacked(block.timestamp, _teeIds[0]));
    }

    function getTeeExtensionInstructionsSender(uint256) external view returns (address) {
        return instructionsSender;
    }

    function extensionsCounter() external view returns (uint256) {
        return counter;
    }
}

// ---------------------------------------------------------------------------
// Mock TEE Machine Registry
// ---------------------------------------------------------------------------
contract MockTeeMachineRegistry {
    function getRandomTeeIds(uint256, uint256 _count) external view returns (address[] memory) {
        address[] memory ids = new address[](_count);
        ids[0] = address(0xBEEF);
        return ids;
    }
}

// ---------------------------------------------------------------------------
// InstructionSender Tests
// ---------------------------------------------------------------------------
contract InstructionSenderTest is Test {
    InstructionSender internal sender;
    MockTeeExtensionRegistry internal mockExtRegistry;
    MockTeeMachineRegistry internal mockMachineRegistry;

    address internal alice = makeAddr("alice");

    function setUp() public {
        mockExtRegistry = new MockTeeExtensionRegistry();
        mockMachineRegistry = new MockTeeMachineRegistry();

        sender = new InstructionSender(
            address(mockExtRegistry),
            address(mockMachineRegistry)
        );

        // Register the sender so setExtensionId() can find it
        mockExtRegistry.register(address(sender));
        sender.setExtensionId();
    }

    function test_setExtensionId_findsCorrectId() public view {
        assertEq(sender.getExtensionId(), 1);
    }

    function test_requestCreditScore_callsSendInstructions() public {
        bytes memory payload = abi.encode("encrypted_plaid_token");

        address[] memory expectedTeeIds = new address[](1);
        expectedTeeIds[0] = address(0xBEEF);

        vm.expectEmit(true, true, true, true, address(mockExtRegistry));
        emit MockTeeExtensionRegistry.InstructionsSent(
            expectedTeeIds,
            sender.OP_TYPE_CREDIT(),
            sender.OP_COMMAND_SCORE(),
            alice
        );

        vm.prank(alice);
        sender.requestCreditScore(payload);
    }

    function test_requestCreditScore_forwardsEther() public {
        bytes memory payload = abi.encode("encrypted_plaid_token");
        uint256 value = 1 ether;

        vm.deal(alice, value);
        vm.prank(alice);
        sender.requestCreditScore{value: value}(payload);

        assertEq(address(mockExtRegistry).balance, value);
    }

    function test_requestCreditScore_correctOpTypeAndCommand() public {
        bytes memory payload = abi.encode("test");

        address[] memory expectedTeeIds = new address[](1);
        expectedTeeIds[0] = address(0xBEEF);

        vm.expectEmit(true, true, true, true, address(mockExtRegistry));
        emit MockTeeExtensionRegistry.InstructionsSent(
            expectedTeeIds,
            bytes32("CREDIT"),
            bytes32("SCORE"),
            alice
        );

        vm.prank(alice);
        sender.requestCreditScore(payload);
    }

    function test_requestCreditScore_revertsWithoutExtensionId() public {
        InstructionSender freshSender = new InstructionSender(
            address(mockExtRegistry),
            address(mockMachineRegistry)
        );

        vm.expectRevert("extension ID not set");
        freshSender.requestCreditScore(abi.encode("test"));
    }

    function test_constructor_setsRegistries() public view {
        assertEq(address(sender.teeExtensionRegistry()), address(mockExtRegistry));
        assertEq(address(sender.teeMachineRegistry()), address(mockMachineRegistry));
    }
}
