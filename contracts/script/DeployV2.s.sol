// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CreditVault.sol";
import "../src/SmartAccountReceiver.sol";

/// @notice Redeploy CreditVault + SmartAccountReceiver, reusing existing InstructionSender (ext 300).
contract DeployV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ftsoV2 = vm.envAddress("FTSOV2_ADDRESS");
        address fxrp = vm.envAddress("FXRP_ADDRESS");
        address teeMachineRegistry = vm.envAddress("TEE_MACHINE_REGISTRY");

        // Reuse existing InstructionSender registered as extension 300
        address instructionSender = 0xBc136df2065B662177C163bbF2c17e5f5E9222c7;
        uint256 extensionId = 300;

        vm.startBroadcast(deployerPrivateKey);

        CreditVault vault = new CreditVault(ftsoV2, fxrp, teeMachineRegistry, extensionId, 24 hours);
        console.log("CreditVault:", address(vault));

        SmartAccountReceiver receiver = new SmartAccountReceiver(address(vault), instructionSender, fxrp);
        console.log("SmartAccountReceiver:", address(receiver));

        vault.setSmartAccountReceiver(address(receiver));
        console.log("CreditVault authorized SmartAccountReceiver");

        vault.fundPoolFLR{value: 1 ether}();
        console.log("Funded vault with 1 FLR");

        vm.stopBroadcast();
    }
}
