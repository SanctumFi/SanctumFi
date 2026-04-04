// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/CreditVault.sol";
import "../src/interfaces/IFtsoV2.sol";

/// @notice Verifies that ABI-encoded TEE output (address, uint256, uint256)
///         can be decoded and fed to CreditVault.receiveScore() with a valid signature.
contract TeeRoundTripTest is Test {
    CreditVault internal vault;
    uint256 internal teePrivateKey;
    address internal teeSigner;

    // Mock FTSO that returns fixed prices
    MockFtsoV2 internal mockFtso;
    MockFXRP internal mockFxrp;

    function setUp() public {
        // TEE signer keypair
        teePrivateKey = 0xA11CE;
        teeSigner = vm.addr(teePrivateKey);

        mockFtso = new MockFtsoV2();
        mockFxrp = new MockFXRP();

        vault = new CreditVault(
            address(mockFtso),
            address(mockFxrp),
            teeSigner,
            24 hours
        );
    }

    /// @notice Simulates the full TEE → contract round-trip:
    ///   1. TEE handler returns ABI-encoded (address, uint256, uint256)
    ///   2. Relayer decodes the data
    ///   3. TEE node signs keccak256(abi.encodePacked(user, score, timestamp))
    ///   4. Relayer calls receiveScore() with decoded values + signature
    function test_teeOutputDecodesAndStoresScore() public {
        address user = makeAddr("borrower");
        uint256 score = 850;
        uint256 timestamp = block.timestamp;

        // Step 1: Simulate TEE handler output — ABI encode (address, uint256, uint256)
        bytes memory teeOutput = abi.encode(user, score, timestamp);

        // Step 2: Relayer decodes the TEE output
        (address decodedUser, uint256 decodedScore, uint256 decodedTimestamp) =
            abi.decode(teeOutput, (address, uint256, uint256));

        assertEq(decodedUser, user);
        assertEq(decodedScore, score);
        assertEq(decodedTimestamp, timestamp);

        // Step 3: TEE node signs the message (abi.encodePacked matching CreditVault)
        bytes32 messageHash = keccak256(abi.encodePacked(decodedUser, decodedScore, decodedTimestamp));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSignedHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Step 4: Call receiveScore
        vault.receiveScore(decodedUser, decodedScore, decodedTimestamp, sig);

        // Verify score was stored — read individual fields to avoid stack-too-deep
        {
            (uint256 storedScore,,,,,,,) = vault.positions(user);
            assertEq(storedScore, score);
        }
        {
            (, uint256 storedTimestamp,,,,,,) = vault.positions(user);
            assertEq(storedTimestamp, timestamp);
        }
    }

    function test_teeOutputWithAllTiers() public {
        uint256[4] memory scores = [uint256(900), uint256(700), uint256(500), uint256(200)];
        uint256[4] memory expectedLtvs = [uint256(8000), uint256(12000), uint256(15000), uint256(20000)];

        for (uint256 i = 0; i < 4; i++) {
            address user = vm.addr(uint256(keccak256(abi.encodePacked("user", i))) % (type(uint160).max - 1) + 1);
            uint256 timestamp = block.timestamp;

            // Simulate TEE output
            bytes memory teeOutput = abi.encode(user, scores[i], timestamp);
            (address decodedUser, uint256 decodedScore, uint256 decodedTimestamp) =
                abi.decode(teeOutput, (address, uint256, uint256));

            // Sign
            bytes32 messageHash = keccak256(abi.encodePacked(decodedUser, decodedScore, decodedTimestamp));
            bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSignedHash);

            vault.receiveScore(decodedUser, decodedScore, decodedTimestamp, abi.encodePacked(r, s, v));

            // Verify LTV tier
            assertEq(vault.getLtvBps(decodedScore), expectedLtvs[i]);
        }
    }

    function test_wrongSignerReverts() public {
        address user = makeAddr("borrower");
        uint256 score = 750;
        uint256 timestamp = block.timestamp;

        bytes memory teeOutput = abi.encode(user, score, timestamp);
        (address decodedUser, uint256 decodedScore, uint256 decodedTimestamp) =
            abi.decode(teeOutput, (address, uint256, uint256));

        // Sign with a WRONG key
        uint256 wrongKey = 0xBAD;
        bytes32 messageHash = keccak256(abi.encodePacked(decodedUser, decodedScore, decodedTimestamp));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSignedHash);

        vm.expectRevert("CreditVault: invalid TEE signature");
        vault.receiveScore(decodedUser, decodedScore, decodedTimestamp, abi.encodePacked(r, s, v));
    }

    function test_tamperedScoreReverts() public {
        address user = makeAddr("borrower");
        uint256 score = 850;
        uint256 timestamp = block.timestamp;

        // Sign with correct score
        bytes32 messageHash = keccak256(abi.encodePacked(user, score, timestamp));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSignedHash);

        // Try to submit with tampered score
        vm.expectRevert("CreditVault: invalid TEE signature");
        vault.receiveScore(user, 1000, timestamp, abi.encodePacked(r, s, v));
    }
}

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------
contract MockFtsoV2 is IFtsoV2 {
    function getFeedById(bytes21) external payable override returns (uint256, int8, uint64) {
        return (3000, 2, uint64(block.timestamp)); // $30.00
    }
    function getFeedsById(bytes21[] calldata _feedIds) external payable override returns (uint256[] memory _values, int8[] memory _decimals, uint64 _timestamp) {
        _values = new uint256[](_feedIds.length);
        _decimals = new int8[](_feedIds.length);
        for (uint256 i = 0; i < _feedIds.length; i++) {
            _values[i] = 3000;
            _decimals[i] = 2;
        }
        _timestamp = uint64(block.timestamp);
    }
}

contract MockFXRP is IERC20 {
    function totalSupply() external pure returns (uint256) { return 0; }
    function balanceOf(address) external pure returns (uint256) { return 0; }
    function transfer(address, uint256) external pure returns (bool) { return true; }
    function allowance(address, address) external pure returns (uint256) { return 0; }
    function approve(address, uint256) external pure returns (bool) { return true; }
    function transferFrom(address, address, uint256) external pure returns (bool) { return true; }
}
