import { describe, it, expect } from "vitest";
import { encodeCreditScoreResult } from "../app/abi.js";
import { decodeAbiParameters } from "viem";

describe("encodeCreditScoreResult", () => {
  it("produces a valid 0x-prefixed hex string", () => {
    const result = encodeCreditScoreResult(
      "0x1234567890AbcdEF1234567890aBcdef12345678",
      850,
      1700000000
    );
    expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("round-trips through ABI decode", () => {
    const addr = "0x1234567890AbcdEF1234567890aBcdef12345678";
    const score = 750;
    const ts = 1700000000;

    const encoded = encodeCreditScoreResult(addr, score, ts);
    const [decodedAddr, decodedScore, decodedTs] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    expect(decodedAddr.toLowerCase()).toBe(addr.toLowerCase());
    expect(Number(decodedScore)).toBe(score);
    expect(Number(decodedTs)).toBe(ts);
  });

  it("handles score of 0", () => {
    const encoded = encodeCreditScoreResult(
      "0x0000000000000000000000000000000000000001",
      0,
      1700000000
    );
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );
    expect(Number(decodedScore)).toBe(0);
  });

  it("handles max score of 1000", () => {
    const encoded = encodeCreditScoreResult(
      "0x0000000000000000000000000000000000000001",
      1000,
      1700000000
    );
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );
    expect(Number(decodedScore)).toBe(1000);
  });
});
