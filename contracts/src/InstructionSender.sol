// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./interfaces/ITeeExtensionRegistry.sol";

contract InstructionSender {
    ITeeExtensionRegistry public immutable registry;
    uint256 public immutable extensionId;

    bytes32 public constant OP_TYPE_CREDIT = bytes32("CREDIT");
    bytes32 public constant OP_COMMAND_SCORE = bytes32("SCORE");

    constructor(address _registry, uint256 _extensionId) {
        registry = ITeeExtensionRegistry(_registry);
        extensionId = _extensionId;
    }

    function requestCreditScore(bytes calldata encryptedPlaidPayload) external payable {
        address[] memory cosigners = new address[](0);

        TeeInstructionParams memory params = TeeInstructionParams({
            opType: OP_TYPE_CREDIT,
            opCommand: OP_COMMAND_SCORE,
            message: encryptedPlaidPayload,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        registry.sendInstruction{value: msg.value}(extensionId, params);
    }
}
