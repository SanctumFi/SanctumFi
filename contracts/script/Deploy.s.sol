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
        address teeRegistry = vm.envAddress("TEE_EXTENSION_REGISTRY");
        uint256 extensionId = vm.envUint("TEE_EXTENSION_ID");

        vm.startBroadcast(deployerPrivateKey);

        InstructionSender instructionSender = new InstructionSender(teeRegistry, extensionId);
        console.log("InstructionSender:", address(instructionSender));

        address deployer = vm.addr(deployerPrivateKey);
        CreditVault vault = new CreditVault(ftsoV2, fxrp, deployer, 24 hours);
        console.log("CreditVault:", address(vault));

        SmartAccountReceiver receiver = new SmartAccountReceiver(address(vault), address(instructionSender), fxrp);
        console.log("SmartAccountReceiver:", address(receiver));

        vault.fundPoolFLR{value: 10 ether}();
        console.log("Funded vault with 10 FLR");

        vm.stopBroadcast();
    }
}
