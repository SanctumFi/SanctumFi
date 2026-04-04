// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./interfaces/ICreditVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SmartAccountReceiver {
    using SafeERC20 for IERC20;

    ICreditVault public immutable vault;
    address public immutable instructionSender;
    IERC20 public immutable fxrp;

    mapping(bytes32 => address) public xrplToFlare;

    event XrplUserMapped(bytes32 indexed xrplAddress, address flareAddress);
    event ActionRouted(bytes32 indexed xrplAddress, string action);

    constructor(address _vault, address _instructionSender, address _fxrp) {
        vault = ICreditVault(_vault);
        instructionSender = _instructionSender;
        fxrp = IERC20(_fxrp);
    }

    function _getOrCreateFlareAddress(bytes32 xrplAddress) internal returns (address) {
        if (xrplToFlare[xrplAddress] == address(0)) {
            address flareAddr = address(uint160(uint256(keccak256(abi.encodePacked(xrplAddress, address(this))))));
            xrplToFlare[xrplAddress] = flareAddr;
            emit XrplUserMapped(xrplAddress, flareAddr);
        }
        return xrplToFlare[xrplAddress];
    }

    function handleDeposit(bytes32 xrplAddress) external payable {
        _getOrCreateFlareAddress(xrplAddress);
        emit ActionRouted(xrplAddress, "deposit");
    }

    function handleScoreRequest(bytes32 xrplAddress, bytes calldata encryptedPayload) external payable {
        _getOrCreateFlareAddress(xrplAddress);
        emit ActionRouted(xrplAddress, "score");
    }

    function handleBorrow(bytes32 xrplAddress, address asset, uint256 amount) external {
        _getOrCreateFlareAddress(xrplAddress);
        emit ActionRouted(xrplAddress, "borrow");
    }

    function handleRepay(bytes32 xrplAddress, address asset) external payable {
        _getOrCreateFlareAddress(xrplAddress);
        emit ActionRouted(xrplAddress, "repay");
    }

    receive() external payable {}
}
