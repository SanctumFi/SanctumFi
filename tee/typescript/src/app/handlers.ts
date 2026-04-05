/** Handler functions for the CREDIT extension operations. */

import http from "node:http";
import { Framework } from "../base/types.js";
import { hexToBytes } from "../base/encoding.js";
import { keccak256, encodeAbiParameters, encodePacked } from "viem";
import { VERSION, OP_TYPE_CREDIT, OP_COMMAND_SCORE } from "./config.js";
import { fetchPlaidData } from "./plaid.js";
import { computeCreditScore } from "./scoring.js";

/** Mutable state — the framework serializes all handler calls. */
let lastScore: { address: string; score: number; timestamp: number } | null =
  null;
let signPort = "9090";

/** Set the sign port for communicating with the TEE node. */
export function setSignPort(port: string): void {
  signPort = port;
}

/** Register the CREDIT handlers with the framework. */
export function register(framework: Framework): void {
  framework.handle(OP_TYPE_CREDIT, OP_COMMAND_SCORE, handleCreditScore);
}

/** Return a JSON-serializable snapshot of the current state. */
export function reportState(): unknown {
  return {
    lastScore,
    version: VERSION,
  };
}

/**
 * Handle a credit score request.
 *
 * The message is a hex-encoded ECIES ciphertext containing JSON:
 *   { "plaid_access_token": "...", "user_address": "0x..." }
 *
 * Returns ABI-encoded (address, uint256, uint256, bytes) = (user, score, timestamp, signature).
 */
async function handleCreditScore(
  msg: string
): Promise<[string | null, number, string | null]> {
  if (!msg) {
    return [null, 0, "originalMessage is empty"];
  }

  // 1. Hex-decode to get ECIES ciphertext bytes
  let ciphertext: Uint8Array;
  try {
    ciphertext = hexToBytes(msg);
  } catch (e) {
    return [null, 0, `invalid hex in originalMessage: ${e}`];
  }

  // 2. Decrypt via TEE node's /decrypt endpoint
  let plaintext: Uint8Array;
  try {
    plaintext = await decryptViaNode(ciphertext);
  } catch (e) {
    return [null, 0, `decryption failed: ${e}`];
  }

  // 3. Parse the decrypted JSON payload
  let payload: { plaid_access_token: string; user_address: string };
  try {
    payload = JSON.parse(Buffer.from(plaintext).toString("utf-8"));
  } catch (e) {
    return [null, 0, `invalid JSON payload: ${e}`];
  }

  if (!payload.plaid_access_token || !payload.user_address) {
    return [null, 0, "missing plaid_access_token or user_address"];
  }

  // 4. Fetch Plaid banking data
  let plaidData;
  try {
    plaidData = await fetchPlaidData(payload.plaid_access_token);
  } catch (e) {
    return [null, 0, `plaid API error: ${e}`];
  }

  // 5. Compute credit score
  const scoreResult = computeCreditScore(plaidData);
  const timestamp = Math.floor(Date.now() / 1000);

  // 6. Sign the score with the TEE node's private key.
  //    CreditVault verifies: keccak256(abi.encodePacked(user, score, timestamp))
  //    wrapped with "\x19Ethereum Signed Message:\n32" prefix.
  let signature: string;
  try {
    const messageHash = keccak256(
      encodePacked(
        ["address", "uint256", "uint256"],
        [payload.user_address as `0x${string}`, BigInt(scoreResult.total), BigInt(timestamp)]
      )
    );
    // Apply EIP-191 prefix: "\x19Ethereum Signed Message:\n32" + hash
    const prefix = Buffer.from("\x19Ethereum Signed Message:\n32");
    const hashBytes = hexToBytes(messageHash);
    const ethSignedHash = new Uint8Array(prefix.length + hashBytes.length);
    ethSignedHash.set(prefix);
    ethSignedHash.set(hashBytes, prefix.length);
    const toSign = keccak256(ethSignedHash);

    signature = await signViaNode(hexToBytes(toSign));
  } catch (e) {
    return [null, 0, `TEE signing failed: ${e}`];
  }

  // 7. ABI-encode result as (address, uint256, uint256, bytes)
  let encoded: string;
  try {
    encoded = encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes" },
      ],
      [
        payload.user_address as `0x${string}`,
        BigInt(scoreResult.total),
        BigInt(timestamp),
        signature as `0x${string}`,
      ]
    );
  } catch (e) {
    return [null, 0, `ABI encoding failed: ${e}`];
  }

  // 8. Update state
  lastScore = {
    address: payload.user_address,
    score: scoreResult.total,
    timestamp,
  };

  console.log(
    `credit score computed: address=${payload.user_address} score=${scoreResult.total}`
  );

  return [encoded, 1, null];
}

/**
 * Sign a message via the TEE node's /sign endpoint.
 * Returns the signature as a 0x-prefixed hex string.
 */
function signViaNode(message: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${signPort}/sign`;
    const body = JSON.stringify({
      message: Buffer.from(message).toString("base64"),
    });

    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode !== 200) {
            reject(new Error(`sign node returned ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const sigBytes = Buffer.from(parsed.signature, "base64");
            resolve("0x" + sigBytes.toString("hex"));
          } catch (e) {
            reject(new Error(`decode sign response: ${e}`));
          }
        });
      }
    );

    req.on("error", (e) => reject(new Error(`sign request error: ${e.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * Decrypt ciphertext via the TEE node's /decrypt endpoint.
 * The TEE node uses base64 encoding for encrypt/decrypt.
 */
function decryptViaNode(ciphertext: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${signPort}/decrypt`;
    const body = JSON.stringify({
      encryptedMessage: Buffer.from(ciphertext).toString("base64"),
    });

    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode !== 200) {
            reject(new Error(`node returned ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve(
              new Uint8Array(Buffer.from(parsed.decryptedMessage, "base64"))
            );
          } catch (e) {
            reject(new Error(`decode response: ${e}`));
          }
        });
      }
    );

    req.on("error", (e) => reject(new Error(`request error: ${e.message}`)));
    req.write(body);
    req.end();
  });
}
