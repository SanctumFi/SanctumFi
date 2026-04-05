import { useState } from "react";
import {
  createWalletClient,
  http,
  parseAbi,
  decodeAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, flareTestnet } from "../lib/flareClient";

// ── Config ──────────────────────────────────────────────────────────────────

const PROXY_URL = "http://localhost:6676";
const INSTRUCTION_SENDER = (import.meta.env.VITE_INSTRUCTION_SENDER_ADDRESS || "0x") as Address;
const CREDIT_VAULT = (import.meta.env.VITE_CREDIT_VAULT_ADDRESS || "0x") as Address;

/** Deployer key — hackathon demo only; production would use a relayer. */
const DEPLOYER_KEY = "0x819a4345c69fc281b18df8e7141d8fa81c7151a4e3a60373609333329fe19817" as `0x${string}`;

const PLAID_ACCESS_TOKEN = "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6";

const instructionSenderAbi = parseAbi([
  "function requestCreditScore(bytes _encryptedPayload) external payable",
]);

const creditVaultAbi = parseAbi([
  "function receiveScore(address user, uint256 score, uint256 timestamp, bytes sig) external",
]);

// ── ECIES encryption (matches TEE node's Go ECIES) ─────────────────────────

async function eciesEncrypt(pubKeyHex: string, plaintext: Uint8Array): Promise<Uint8Array> {
  // Generate ephemeral secp256k1 keypair
  const { etc: secpEtc, getPublicKey, getSharedSecret } = await import("@noble/secp256k1");
  const ephPriv = secpEtc.randomPrivateKey();
  const ephPub = getPublicKey(ephPriv, false); // uncompressed 65 bytes

  // ECDH shared secret
  const pubKeyBytes = hexToU8(pubKeyHex);
  const shared = getSharedSecret(ephPriv, pubKeyBytes, false);
  const sharedX = shared.slice(1, 33);

  // KDF: SHA-256 of shared x-coordinate
  const keyMaterial = new Uint8Array(await crypto.subtle.digest("SHA-256", sharedX));
  const encKey = keyMaterial.slice(0, 16);
  const macKey = keyMaterial.slice(16, 32);

  // AES-128-CTR encrypt
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await crypto.subtle.importKey("raw", encKey, { name: "AES-CTR" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CTR", counter: iv, length: 128 }, aesKey, plaintext)
  );

  // HMAC-SHA-256 over iv + ciphertext
  const hmacKey = await crypto.subtle.importKey("raw", macKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const macData = new Uint8Array(iv.length + ciphertext.length);
  macData.set(iv);
  macData.set(ciphertext, iv.length);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, macData));

  // Format: ephemeral_pub(65) + iv(16) + ciphertext + mac(32)
  const result = new Uint8Array(ephPub.length + iv.length + ciphertext.length + mac.length);
  result.set(ephPub);
  result.set(iv, ephPub.length);
  result.set(ciphertext, ephPub.length + iv.length);
  result.set(mac, ephPub.length + iv.length + ciphertext.length);
  return result;
}

function hexToU8(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  return bytes;
}

function u8ToHex(bytes: Uint8Array): `0x${string}` {
  return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

// ── Poll proxy for TEE result ───────────────────────────────────────────────

async function pollResult(
  instructionId: string,
  onProgress?: (msg: string) => void,
  maxAttempts = 90,
): Promise<{ data: `0x${string}`; status: number; log: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${PROXY_URL}/action/result/${instructionId}`);
      if (resp.ok) {
        const json = await resp.json();
        const r = json?.result ?? json;
        if (r?.status >= 1) return r;
        if (r?.status === 0) throw new Error(r.log || "TEE processing failed");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("TEE processing failed")) throw e;
    }
    if (i % 5 === 0) onProgress?.(`Waiting for TEE result (${i + 1}/${maxAttempts})...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("TEE result polling timed out");
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCreditScore(personalAccount: Address | null) {
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestScore() {
    if (!personalAccount) throw new Error("No personal account");
    setRequesting(true);
    setError(null);
    setStatus("Fetching TEE public key...");

    try {
      // 1. Get TEE public key from proxy
      const infoResp = await fetch(`${PROXY_URL}/info`);
      if (!infoResp.ok) throw new Error("Cannot reach TEE proxy");
      const info = await infoResp.json();
      const pubX = (info.teeInfo.publicKey.x as string).replace("0x", "");
      const pubY = (info.teeInfo.publicKey.y as string).replace("0x", "");
      const pubKeyHex = "04" + pubX + pubY;

      // 2. ECIES-encrypt the Plaid payload
      setStatus("Encrypting payload...");
      const payload = JSON.stringify({
        plaid_access_token: PLAID_ACCESS_TOKEN,
        user_address: personalAccount,
      });
      const encrypted = await eciesEncrypt(pubKeyHex, new TextEncoder().encode(payload));

      // 3. Send requestCreditScore on-chain via deployer key
      setStatus("Sending instruction to TEE...");
      const account = privateKeyToAccount(DEPLOYER_KEY);
      const walletClient = createWalletClient({
        chain: flareTestnet,
        transport: http(),
        account,
      });

      const txHash = await walletClient.writeContract({
        address: INSTRUCTION_SENDER,
        abi: instructionSenderAbi,
        functionName: "requestCreditScore",
        args: [u8ToHex(encrypted)],
        value: 1_000_000_000_000n, // 0.000001 FLR fee
      });

      setStatus("Transaction sent, waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");

      // 4. Extract instruction ID from logs
      // The TeeExtensionRegistry emits TeeInstructionsSent with instructionId in the event data
      let instructionId: string | null = null;
      for (const log of receipt.logs) {
        // TeeInstructionsSent event — instructionId is typically in data
        if (log.address.toLowerCase() === "0x3d478d43426081BD5854be9C7c5c183bfe76C981".toLowerCase()) {
          // The instruction ID is a bytes32 in the event
          if (log.data.length >= 66) {
            instructionId = log.data.slice(0, 66);
          }
          break;
        }
      }

      if (!instructionId) {
        // Fallback: try first log
        if (receipt.logs.length > 0 && receipt.logs[0].data.length >= 66) {
          instructionId = receipt.logs[0].data.slice(0, 66);
        }
      }

      if (!instructionId) throw new Error("Could not find instruction ID in transaction logs");

      // 5. Poll proxy for TEE result
      setStatus("TEE is computing your credit score...");
      const result = await pollResult(instructionId, setStatus);

      // 6. Decode result: (address, uint256, uint256, bytes)
      setStatus("Score computed! Submitting to blockchain...");
      const decoded = decodeAbiParameters(
        [
          { type: "address", name: "user" },
          { type: "uint256", name: "score" },
          { type: "uint256", name: "timestamp" },
          { type: "bytes", name: "signature" },
        ],
        result.data as `0x${string}`,
      );

      const [user, score, timestamp, signature] = decoded;

      // 7. Call CreditVault.receiveScore()
      const scoreTx = await walletClient.writeContract({
        address: CREDIT_VAULT,
        abi: creditVaultAbi,
        functionName: "receiveScore",
        args: [user as Address, score as bigint, timestamp as bigint, signature as `0x${string}`],
      });

      await publicClient.waitForTransactionReceipt({ hash: scoreTx });
      setStatus("Credit score saved on-chain!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to request score";
      setError(msg);
      setStatus(null);
    } finally {
      setRequesting(false);
    }
  }

  return { requestScore, requesting, status, error };
}
