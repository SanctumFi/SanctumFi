// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ITeeMachineRegistry {
    function getRandomTeeIds(
        uint256 _extensionId,
        uint256 _count
    ) external view returns (address[] memory);

    function getActiveTeeMachines(
        uint256 _extensionId
    ) external view returns (address[] memory _teeIds, string[] memory _urls);

    function getExtensionId(
        address _teeId
    ) external view returns (uint256);
}
