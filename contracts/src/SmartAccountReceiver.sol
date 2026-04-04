// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./interfaces/ICreditVault.sol";
import "./interfaces/IInstructionSender.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SmartAccountReceiver — routes XRPL Smart Account actions to CreditVault
/// @notice XRPL users send payment memos that an operator relays here.
///         Each XRPL address maps to a deterministic Flare address used as position key.
contract SmartAccountReceiver {
    using SafeERC20 for IERC20;

    ICreditVault public immutable vault;
    IInstructionSender public immutable instructionSender;
    IERC20 public immutable fxrp;

    /// @notice XRPL address → deterministic Flare position key.
    mapping(bytes32 => address) public xrplToFlare;

    /// @notice Borrowed funds held on behalf of XRPL users.
    mapping(address => uint256) public borrowedFLR;
    mapping(address => uint256) public borrowedFXRP;

    event XrplUserMapped(bytes32 indexed xrplAddress, address flareAddress);
    event ActionRouted(bytes32 indexed xrplAddress, string action);

    constructor(address _vault, address _instructionSender, address _fxrp) {
        vault = ICreditVault(_vault);
        instructionSender = IInstructionSender(_instructionSender);
        fxrp = IERC20(_fxrp);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _getOrCreateFlareAddress(bytes32 xrplAddress) internal returns (address) {
        if (xrplToFlare[xrplAddress] == address(0)) {
            address flareAddr = address(uint160(uint256(keccak256(abi.encodePacked(xrplAddress, address(this))))));
            xrplToFlare[xrplAddress] = flareAddr;
            emit XrplUserMapped(xrplAddress, flareAddr);
        }
        return xrplToFlare[xrplAddress];
    }

    // -------------------------------------------------------------------------
    // Handlers (called by operator relay)
    // -------------------------------------------------------------------------

    /// @notice Deposit FLR collateral on behalf of an XRPL user.
    function handleDeposit(bytes32 xrplAddress) external payable {
        address user = _getOrCreateFlareAddress(xrplAddress);
        vault.depositFLRFor{value: msg.value}(user);
        emit ActionRouted(xrplAddress, "deposit");
    }

    /// @notice Request a TEE credit score for an XRPL user.
    ///         The encrypted payload contains the Plaid access token + user address.
    function handleScoreRequest(bytes32 xrplAddress, bytes calldata encryptedPayload) external payable {
        _getOrCreateFlareAddress(xrplAddress);
        instructionSender.requestCreditScore{value: msg.value}(encryptedPayload);
        emit ActionRouted(xrplAddress, "score");
    }

    /// @notice Borrow on behalf of an XRPL user. Borrowed funds are held by this contract.
    function handleBorrow(bytes32 xrplAddress, address asset, uint256 amount) external {
        address user = _getOrCreateFlareAddress(xrplAddress);
        uint256 balBefore;
        if (asset == address(0)) {
            balBefore = address(this).balance;
        } else {
            balBefore = fxrp.balanceOf(address(this));
        }

        vault.borrowFor(user, asset, amount);

        // Track borrowed funds received from vault.
        if (asset == address(0)) {
            borrowedFLR[user] += address(this).balance - balBefore;
        } else {
            borrowedFXRP[user] += fxrp.balanceOf(address(this)) - balBefore;
        }

        emit ActionRouted(xrplAddress, "borrow");
    }

    /// @notice Repay FLR debt on behalf of an XRPL user. Send FLR as msg.value.
    function handleRepay(bytes32 xrplAddress, address asset) external payable {
        address user = _getOrCreateFlareAddress(xrplAddress);
        vault.repayFor{value: msg.value}(user, asset, 0);
        emit ActionRouted(xrplAddress, "repay");
    }

    /// @notice Accept FLR from vault (borrow proceeds, refunds).
    receive() external payable {}
}
