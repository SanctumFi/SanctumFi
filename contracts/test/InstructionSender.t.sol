// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/InstructionSender.sol";
import "../src/interfaces/ITeeExtensionRegistry.sol";

// ---------------------------------------------------------------------------
// Mock TEE Registry — accepts sendInstruction and emits event
// ---------------------------------------------------------------------------
contract MockTeeRegistry {
    event InstructionSent(
        uint256 extensionId,
        bytes32 opType,
        bytes32 opCommand,
        address claimBackAddress
    );

    function sendInstruction(
        uint256 extensionId,
        TeeInstructionParams calldata params
    ) external payable {
        emit InstructionSent(
            extensionId,
            params.opType,
            params.opCommand,
            params.claimBackAddress
        );
    }
}

// ---------------------------------------------------------------------------
// InstructionSender Tests
// ---------------------------------------------------------------------------
contract InstructionSenderTest is Test {
    InstructionSender internal sender;
    MockTeeRegistry internal mockRegistry;

    address internal alice = makeAddr("alice");
    uint256 internal constant EXTENSION_ID = 42;

    function setUp() public {
        mockRegistry = new MockTeeRegistry();
        sender = new InstructionSender(address(mockRegistry), EXTENSION_ID);
    }

    function test_requestCreditScore_callsSendInstruction() public {
        bytes memory payload = abi.encode("encrypted_plaid_token");

        vm.expectEmit(true, true, true, true, address(mockRegistry));
        emit MockTeeRegistry.InstructionSent(
            EXTENSION_ID,
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

        vm.expectEmit(true, true, true, true, address(mockRegistry));
        emit MockTeeRegistry.InstructionSent(
            EXTENSION_ID,
            sender.OP_TYPE_CREDIT(),
            sender.OP_COMMAND_SCORE(),
            alice
        );

        vm.prank(alice);
        sender.requestCreditScore{value: value}(payload);

        assertEq(address(mockRegistry).balance, value);
    }

    function test_requestCreditScore_correctOpTypeAndCommand() public {
        bytes memory payload = abi.encode("test");

        vm.expectEmit(true, true, true, true, address(mockRegistry));
        emit MockTeeRegistry.InstructionSent(
            EXTENSION_ID,
            bytes32("CREDIT"),
            bytes32("SCORE"),
            alice
        );

        vm.prank(alice);
        sender.requestCreditScore(payload);
    }

    function test_constructor_setsRegistryAndExtensionId() public view {
        assertEq(address(sender.registry()), address(mockRegistry));
        assertEq(sender.extensionId(), EXTENSION_ID);
    }
}
