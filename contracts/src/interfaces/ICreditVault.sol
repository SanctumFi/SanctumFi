// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface ICreditVault {
    function receiveScore(address user, uint256 score, uint256 timestamp, bytes calldata sig) external;
    function depositFLR() external payable;
    function depositFXRP(uint256 amount) external;
    function borrow(address asset, uint256 amount) external;
    function repay(address asset, uint256 amount) external payable;
    function withdrawCollateral(address asset, uint256 amount) external;
    function liquidate(address user) external;
    function getDebt(address user) external returns (uint256 flrDebt, uint256 fxrpDebt);
    function getHealthFactor(address user) external returns (uint256);
    function getMaxBorrow(address user, address asset) external returns (uint256);

    // Smart Account proxy functions
    function depositFLRFor(address user) external payable;
    function depositFXRPFor(address user, uint256 amount) external;
    function borrowFor(address user, address asset, uint256 amount) external;
    function repayFor(address user, address asset, uint256 amount) external payable;
    function withdrawCollateralFor(address user, address asset, uint256 amount) external;
}
