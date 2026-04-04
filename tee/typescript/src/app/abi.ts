/** ABI encoding for credit score results. */

import { encodeAbiParameters } from "viem";
import { bytesToHex } from "../base/encoding.js";

/**
 * ABI-encode a credit score result as (address, uint256, uint256).
 * Returns a 0x-prefixed hex string.
 */
export function encodeCreditScoreResult(
  userAddress: string,
  score: number,
  timestamp: number
): string {
  return encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    [userAddress as `0x${string}`, BigInt(score), BigInt(timestamp)]
  );
}
