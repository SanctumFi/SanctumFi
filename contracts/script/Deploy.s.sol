// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CreditVault.sol";
import "../src/InstructionSender.sol";
import "../src/SmartAccountReceiver.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ftsoV2 = vm.envAddress("FTSOV2_ADDRESS");
        address fxrp = vm.envAddress("FXRP_ADDRESS");
        address teeExtensionRegistry = vm.envAddress("TEE_EXTENSION_REGISTRY");
        address teeMachineRegistry = vm.envAddress("TEE_MACHINE_REGISTRY");
        vm.startBroadcast(deployerPrivateKey);

        InstructionSender instructionSender = new InstructionSender(teeExtensionRegistry, teeMachineRegistry);
        console.log("InstructionSender:", address(instructionSender));

        // extensionId must be set after registration — use 0 as placeholder,
        // then redeploy via DeployV2.s.sol once the extension is registered.
        CreditVault vault = new CreditVault(ftsoV2, fxrp, teeMachineRegistry, 0, 24 hours);
        console.log("CreditVault:", address(vault));

        SmartAccountReceiver receiver = new SmartAccountReceiver(address(vault), address(instructionSender), fxrp);
        console.log("SmartAccountReceiver:", address(receiver));

        vault.setSmartAccountReceiver(address(receiver));
        console.log("CreditVault authorized SmartAccountReceiver");

        vault.fundPoolFLR{value: 10 ether}();
        console.log("Funded vault with 10 FLR");

        vm.stopBroadcast();
    }
}
