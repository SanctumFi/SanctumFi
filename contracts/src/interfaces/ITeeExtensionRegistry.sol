// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

struct TeeInstructionParams {
    bytes32 opType;
    bytes32 opCommand;
    bytes message;
    address[] cosigners;
    uint64 cosignersThreshold;
    address claimBackAddress;
}

interface ITeeExtensionRegistry {
    function sendInstructions(
        address[] memory _teeIds,
        TeeInstructionParams memory _instructionParams
    ) external payable returns (bytes32 _instructionId);

    function getTeeExtensionInstructionsSender(
        uint256 _extensionId
    ) external view returns (address);

    function extensionsCounter() external view returns (uint256);
}
