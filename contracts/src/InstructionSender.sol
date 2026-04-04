// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./interfaces/ITeeExtensionRegistry.sol";
import "./interfaces/ITeeMachineRegistry.sol";

contract InstructionSender {
    ITeeExtensionRegistry public immutable teeExtensionRegistry;
    ITeeMachineRegistry public immutable teeMachineRegistry;

    uint256 private _extensionId;

    bytes32 public constant OP_TYPE_CREDIT = bytes32("CREDIT");
    bytes32 public constant OP_COMMAND_SCORE = bytes32("SCORE");

    constructor(address _teeExtensionRegistry, address _teeMachineRegistry) {
        teeExtensionRegistry = ITeeExtensionRegistry(_teeExtensionRegistry);
        teeMachineRegistry = ITeeMachineRegistry(_teeMachineRegistry);
    }

    /// @notice Scan the registry to find this contract's extension ID. Idempotent, call once after registration.
    function setExtensionId() external {
        uint256 count = teeExtensionRegistry.extensionsCounter();
        for (uint256 i = 1; i <= count; i++) {
            if (teeExtensionRegistry.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("extension not found");
    }

    function getExtensionId() external view returns (uint256) {
        return _extensionId;
    }

    function requestCreditScore(bytes calldata _encryptedPayload) external payable {
        require(_extensionId != 0, "extension ID not set");

        address[] memory teeIds = teeMachineRegistry.getRandomTeeIds(_extensionId, 1);

        TeeInstructionParams memory params;
        params.opType = OP_TYPE_CREDIT;
        params.opCommand = OP_COMMAND_SCORE;
        params.message = _encryptedPayload;
        params.claimBackAddress = msg.sender;

        teeExtensionRegistry.sendInstructions{value: msg.value}(teeIds, params);
    }
}
