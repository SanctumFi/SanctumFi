import { useState } from "react";
import {
  createWalletClient,
  http,
  parseAbi,
  decodeAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { utils as secpUtils, getPublicKey, getSharedSecret } from "@noble/secp256k1";
import { publicClient, flareTestnet } from "../lib/flareClient";

// ── Config ──────────────────────────────────────────────────────────────────

const PROXY_URL = "/tee-proxy";
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

// ── ECIES encryption (matches go-ethereum/crypto/ecies ECIES_AES128_SHA256) ──

/**
 * NIST SP 800-56A Concat KDF with SHA-256.
 * Matches Go's ecies concatKDF implementation.
 */
async function concatKDF(sharedSecret: Uint8Array, keyLen: number): Promise<Uint8Array> {
  const reps = Math.ceil(keyLen / 32);
  const result = new Uint8Array(reps * 32);
  for (let counter = 1; counter <= reps; counter++) {
    const buf = new Uint8Array(4 + sharedSecret.length);
    // Big-endian counter
    buf[0] = (counter >> 24) & 0xff;
    buf[1] = (counter >> 16) & 0xff;
    buf[2] = (counter >> 8) & 0xff;
    buf[3] = counter & 0xff;
    buf.set(sharedSecret, 4);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    result.set(hash, (counter - 1) * 32);
  }
  return result.slice(0, keyLen);
}

async function eciesEncrypt(pubKeyHex: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const ephPriv = secpUtils.randomSecretKey();
  const ephPub = getPublicKey(ephPriv, false); // uncompressed 65 bytes

  // ECDH: shared secret = x-coordinate of ephPriv * recipientPub
  const pubKeyBytes = hexToU8(pubKeyHex);
  const shared = getSharedSecret(ephPriv, pubKeyBytes, false);
  const sharedX = shared.slice(1, 33); // x-coordinate only

  // Concat KDF: derive 32 bytes (16 enc + 16 mac)
  const keyMaterial = await concatKDF(sharedX, 32);
  const encKey = keyMaterial.slice(0, 16);
  const macKeySource = keyMaterial.slice(16, 32);

  // MAC key = SHA-256(macKeySource) — Go's ecies does this
  const macKey = new Uint8Array(await crypto.subtle.digest("SHA-256", macKeySource));

  // AES-128-CTR encrypt with zero IV (Go ecies uses implicit zero IV)
  const iv = new Uint8Array(16); // all zeros
  const aesKey = await crypto.subtle.importKey("raw", encKey, { name: "AES-CTR" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CTR", counter: iv, length: 128 }, aesKey, plaintext)
  );

  // HMAC-SHA-256 over ciphertext only (Go ecies MACs only the ciphertext)
  const hmacKey = await crypto.subtle.importKey("raw", macKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, ciphertext));

  // Format: ephemeral_pub(65) + ciphertext + mac(32)
  const result = new Uint8Array(ephPub.length + ciphertext.length + mac.length);
  result.set(ephPub);
  result.set(ciphertext, ephPub.length);
  result.set(mac, ephPub.length + ciphertext.length);
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
  const url = `${PROXY_URL}/action/result/${instructionId}`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        const r = json?.result ?? json;
        if (r?.status >= 1) return r;
        // status 0 = error, but TEE retries on decrypt failure so wait for retry
        if (r?.status === 0 && r.log && !r.log.includes("decrypt")) {
          throw new Error(r.log);
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && !e.message.includes("fetch")) throw e;
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

      // 4. Extract instruction ID from TeeExtensionRegistry log
      // The event is at log[0] from address 0x3d47..., instructionId is in topics[2]
      const TEE_REGISTRY = "0x3d478d43426081bd5854be9c7c5c183bfe76c981";
      let instructionId: string | null = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === TEE_REGISTRY && log.topics.length >= 3) {
          instructionId = log.topics[2];
          break;
        }
      }

      if (!instructionId) throw new Error("Could not find instruction ID in transaction logs");
      console.log("Instruction ID:", instructionId);

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
