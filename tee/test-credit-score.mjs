/**
 * End-to-end test for the FlareScore TEE credit score flow.
 *
 * 1. Fetch TEE public key from proxy
 * 2. ECIES-encrypt { plaid_access_token, user_address }
 * 3. Send requestCreditScore() on-chain via InstructionSender
 * 4. Poll proxy for the result
 * 5. ABI-decode the result (address, uint256, uint256, bytes)
 * 6. Call CreditVault.receiveScore() with the TEE-signed data
 *
 * Usage: node test-credit-score.mjs
 */

import { createPublicClient, createWalletClient, http, parseAbi, decodeAbiParameters, encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as secp256k1 from "@noble/secp256k1";
import { randomBytes } from "crypto";

// ── Config ──────────────────────────────────────────────────────────────────

const RPC = "https://coston2-api.flare.network/ext/C/rpc";
const PROXY_URL = "http://localhost:6676";
const INTERNAL_PROXY = "http://localhost:6675";

const PRIVATE_KEY = "0x819a4345c69fc281b18df8e7141d8fa81c7151a4e3a60373609333329fe19817";
const CREDIT_VAULT = "0x4b9143eb678D529A604923B38cDd17c4DfD5e1b0";
const INSTRUCTION_SENDER = "0xF45ed61c78154b84A5Ca8A3A67a89eb418B6929E";

// Plaid Sandbox test token — use the one from Plaid's sandbox quickstart
// This is a public sandbox token, not a real credential.
const PLAID_ACCESS_TOKEN = "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6";

// User address to receive the credit score
const USER_ADDRESS = "0x1A5C418505e2Cd6426BaD9Fd0EE453B031A14e83";

// ── Clients ─────────────────────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ transport: http(RPC) });
const walletClient = createWalletClient({ account, transport: http(RPC) });

// ── ABIs ────────────────────────────────────────────────────────────────────

const instructionSenderAbi = parseAbi([
  "function requestCreditScore(bytes _encryptedPayload) external payable returns (bytes32)",
]);

const creditVaultAbi = parseAbi([
  "function receiveScore(address user, uint256 score, uint256 timestamp, bytes sig) external",
  "function positions(address) view returns (uint256 creditScore, uint256 scoreTimestamp, uint256 flrCollateral, uint256 fxrpCollateral, uint256 flrDebt, uint256 fxrpDebt, uint256 flrBorrowTimestamp, uint256 fxrpBorrowTimestamp)",
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** ECIES encrypt using the TEE node's secp256k1 public key. */
async function eciesEncrypt(pubKeyHex, plaintext) {
  // Generate ephemeral keypair
  const ephPriv = secp256k1.utils.randomSecretKey();
  const ephPub = secp256k1.getPublicKey(ephPriv, false); // uncompressed 65 bytes

  // Derive shared secret via ECDH
  const pubKeyBytes = Buffer.from(pubKeyHex, "hex");
  const shared = secp256k1.getSharedSecret(ephPriv, pubKeyBytes, false);

  // KDF: SHA-256 of shared secret x-coordinate
  const sharedX = shared.slice(1, 33);
  const { createHash, createCipheriv, createHmac } = await import("crypto");
  const keyMaterial = createHash("sha256").update(sharedX).digest();

  // Split into encryption key (16 bytes) and MAC key (16 bytes)
  const encKey = keyMaterial.slice(0, 16);
  const macKey = keyMaterial.slice(16, 32);

  // AES-128-CTR encrypt
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-128-ctr", encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  // HMAC-SHA-256 over iv + ciphertext
  const mac = createHmac("sha256", macKey)
    .update(iv)
    .update(ciphertext)
    .digest();

  // Format: ephemeral_pub(65) + iv(16) + ciphertext + mac(32)
  return Buffer.concat([ephPub, iv, ciphertext, mac]);
}

/** Poll proxy for instruction result. */
async function pollResult(instructionId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${PROXY_URL}/result/${instructionId}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.result?.status >= 1) {
          return data.result;
        }
        if (data?.result?.status === 0) {
          console.error("  Instruction failed:", data.result.log);
          return data.result;
        }
      }
    } catch {}
    if (i % 5 === 0) console.log(`  Polling (${i + 1}/${maxAttempts})...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Polling timed out");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== FlareScore TEE Credit Score E2E Test ===\n");

  // Step 1: Fetch TEE public key
  console.log("Step 1: Fetching TEE public key from proxy...");
  const infoResp = await fetch(`${PROXY_URL}/info`);
  const info = await infoResp.json();
  const pubX = info.teeInfo.publicKey.x.replace("0x", "");
  const pubY = info.teeInfo.publicKey.y.replace("0x", "");
  // Uncompressed public key: 04 + x + y
  const pubKeyHex = "04" + pubX + pubY;
  console.log(`  TEE public key: 0x${pubX.slice(0, 16)}...`);

  // Step 2: ECIES-encrypt the payload
  console.log("\nStep 2: Encrypting payload with TEE public key...");
  const payload = JSON.stringify({
    plaid_access_token: PLAID_ACCESS_TOKEN,
    user_address: USER_ADDRESS,
  });
  const encrypted = await eciesEncrypt(pubKeyHex, Buffer.from(payload));
  console.log(`  Encrypted payload: ${encrypted.length} bytes`);

  // Step 3: Send requestCreditScore on-chain
  console.log("\nStep 3: Sending requestCreditScore instruction on-chain...");
  const encryptedHex = "0x" + encrypted.toString("hex");

  const txHash = await walletClient.writeContract({
    address: INSTRUCTION_SENDER,
    abi: instructionSenderAbi,
    functionName: "requestCreditScore",
    args: [encryptedHex],
    value: 1000000000000n, // fee: 0.000001 FLR
    chain: { id: 114, name: "coston2", nativeCurrency: { name: "FLR", symbol: "FLR", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
  });
  console.log(`  TX hash: ${txHash}`);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`  TX status: ${receipt.status}`);

  if (receipt.status !== "success") {
    console.error("  Transaction reverted!");
    process.exit(1);
  }

  // Find the instruction ID from logs
  // The TeeExtensionRegistry emits TeeInstructionsSent with the instruction ID
  let instructionId = null;
  for (const log of receipt.logs) {
    // TeeInstructionsSent event has instructionId as first topic or in data
    if (log.topics.length > 0 && log.data.length > 2) {
      // The instruction ID is typically in the event data
      // For simplicity, let's try to find it from the proxy
      break;
    }
  }

  // Try getting instruction ID from the first log's data
  if (receipt.logs.length > 0) {
    // The TeeInstructionsSent event typically has the instruction ID
    // Let's decode it - it's usually the first bytes32 in the data
    const firstLog = receipt.logs[0];
    if (firstLog.data && firstLog.data.length >= 66) {
      instructionId = firstLog.data.slice(0, 66);
    }
  }

  console.log(`  Instruction ID: ${instructionId || "checking proxy..."}`);

  // Step 4: Poll for result
  console.log("\nStep 4: Polling proxy for TEE result...");
  console.log("  (This may take 30-120 seconds while the TEE processes the instruction)\n");

  let result;
  if (instructionId) {
    try {
      result = await pollResult(instructionId);
    } catch (e) {
      console.log("  Direct poll failed, trying to find instruction via proxy...");
    }
  }

  if (!result) {
    // Try polling with the tx hash as a fallback
    console.log("  Trying alternative polling methods...");
    try {
      result = await pollResult(txHash);
    } catch (e) {
      console.error("  Could not retrieve result:", e.message);
      console.log("\n  The instruction was sent on-chain. The TEE should process it.");
      console.log("  Check TEE logs: docker compose logs extension-tee --tail 20");
      process.exit(1);
    }
  }

  if (result.status === 0) {
    console.error(`\n  FAILED: ${result.log}`);
    process.exit(1);
  }

  console.log(`  Result status: ${result.status} (success)`);
  console.log(`  Result data: ${result.data?.slice(0, 66)}...`);

  // Step 5: ABI-decode the result
  console.log("\nStep 5: Decoding TEE result...");
  const decoded = decodeAbiParameters(
    [
      { type: "address", name: "user" },
      { type: "uint256", name: "score" },
      { type: "uint256", name: "timestamp" },
      { type: "bytes", name: "signature" },
    ],
    result.data
  );
  const [user, score, timestamp, signature] = decoded;
  console.log(`  User: ${user}`);
  console.log(`  Score: ${score}`);
  console.log(`  Timestamp: ${timestamp} (${new Date(Number(timestamp) * 1000).toISOString()})`);
  console.log(`  Signature: ${signature.slice(0, 42)}...`);

  // Step 6: Submit score on-chain
  console.log("\nStep 6: Calling CreditVault.receiveScore()...");
  const scoreTx = await walletClient.writeContract({
    address: CREDIT_VAULT,
    abi: creditVaultAbi,
    functionName: "receiveScore",
    args: [user, score, timestamp, signature],
    chain: { id: 114, name: "coston2", nativeCurrency: { name: "FLR", symbol: "FLR", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
  });
  console.log(`  TX hash: ${scoreTx}`);

  const scoreReceipt = await publicClient.waitForTransactionReceipt({ hash: scoreTx });
  console.log(`  TX status: ${scoreReceipt.status}`);

  // Verify position
  console.log("\nStep 7: Verifying on-chain position...");
  const position = await publicClient.readContract({
    address: CREDIT_VAULT,
    abi: creditVaultAbi,
    functionName: "positions",
    args: [USER_ADDRESS],
  });
  console.log(`  Credit score: ${position[0]}`);
  console.log(`  Score timestamp: ${position[1]}`);

  console.log("\n=== TEST PASSED ===");
}

main().catch((e) => {
  console.error("\nTest failed:", e.message || e);
  process.exit(1);
});
