// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IInstructionSender {
    function requestCreditScore(bytes calldata _encryptedPayload) external payable;
}
