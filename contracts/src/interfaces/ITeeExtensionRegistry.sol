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
    function sendInstruction(
        uint256 extensionId,
        TeeInstructionParams calldata params
    ) external payable;
}
