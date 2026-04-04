import { ethers } from "ethers";
import { fetchPlaidData } from "../lib/plaid";
import { computeCreditScore } from "../lib/scoring";

const TEE_NODE_URL = process.env.TEE_NODE_URL || "http://localhost:6663";

async function decryptPayload(encryptedHex: string): Promise<string> {
  const res = await fetch(`${TEE_NODE_URL}/decrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ciphertext: encryptedHex }),
  });
  if (!res.ok) throw new Error(`Decrypt failed: ${res.status}`);
  const data = await res.json();
  return data.plaintext;
}

export async function handleCreditScore(
  msg: string
): Promise<{ data: string | null; status: number; err: Error | null }> {
  try {
    const plaintext = await decryptPayload(msg);
    const payload = JSON.parse(Buffer.from(plaintext, "hex").toString("utf8"));
    const { plaid_access_token, user_address } = payload;

    if (!plaid_access_token || !user_address) {
      return { data: null, status: 0, err: new Error("Missing plaid_access_token or user_address") };
    }

    const plaidData = await fetchPlaidData(plaid_access_token);
    const scoreResult = computeCreditScore(plaidData);

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abiCoder.encode(
      ["address", "uint256", "uint256"],
      [user_address, scoreResult.total, Math.floor(Date.now() / 1000)]
    );

    return { data: encoded.slice(2), status: 1, err: null };
  } catch (e) {
    return { data: null, status: 0, err: e as Error };
  }
}
