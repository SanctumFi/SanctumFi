/**
 * Live Plaid Sandbox integration test.
 *
 * Requires real Plaid Sandbox credentials in environment:
 *   PLAID_CLIENT_ID=...
 *   PLAID_SECRET=...
 *
 * Run with:
 *   PLAID_CLIENT_ID=xxx PLAID_SECRET=yyy npm test -- plaid-sandbox
 *
 * This test hits the actual Plaid Sandbox API — it creates a test access token,
 * fetches real sandbox banking data, computes a credit score, and verifies the
 * full pipeline works end-to-end.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { fetchPlaidData } from "../app/plaid.js";
import { computeCreditScore } from "../app/scoring.js";
import { encodeCreditScoreResult } from "../app/abi.js";
import { decodeAbiParameters } from "viem";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_BASE_URL = "https://sandbox.plaid.com";

// Skip the entire suite if no Plaid credentials
const hasCredentials = PLAID_CLIENT_ID.length > 0 && PLAID_SECRET.length > 0;
const describeOrSkip = hasCredentials ? describe : describe.skip;

/** Create a sandbox access token without Plaid Link */
async function createSandboxAccessToken(): Promise<string> {
  // Step 1: Create a public token via sandbox endpoint
  const publicTokenRes = await fetch(
    `${PLAID_BASE_URL}/sandbox/public_token/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        institution_id: "ins_109508", // First Platypus Bank
        initial_products: ["transactions"],
        options: {
          webhook: "",
        },
      }),
    }
  );

  if (!publicTokenRes.ok) {
    const err = await publicTokenRes.text();
    throw new Error(`Failed to create public token: ${publicTokenRes.status} ${err}`);
  }

  const { public_token } = await publicTokenRes.json();

  // Step 2: Exchange public token for access token
  const exchangeRes = await fetch(
    `${PLAID_BASE_URL}/item/public_token/exchange`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    }
  );

  if (!exchangeRes.ok) {
    const err = await exchangeRes.text();
    throw new Error(`Failed to exchange token: ${exchangeRes.status} ${err}`);
  }

  const { access_token } = await exchangeRes.json();
  return access_token;
}

describeOrSkip("Plaid Sandbox live test", () => {
  let accessToken: string;

  beforeAll(async () => {
    accessToken = await createSandboxAccessToken();
    console.log("Sandbox access token created successfully");
  }, 30000);

  it("fetches real sandbox banking data", async () => {
    const data = await fetchPlaidData(accessToken);

    console.log(`\n  Accounts: ${data.accounts.length}`);
    for (const acc of data.accounts) {
      console.log(`    - ${acc.name} (${acc.type}/${acc.subtype}): $${acc.balances.available ?? acc.balances.current}`);
    }
    console.log(`  Transactions: ${data.transactions.length}`);
    if (data.transactions.length > 0) {
      const sample = data.transactions.slice(0, 5);
      for (const tx of sample) {
        const sign = tx.amount < 0 ? "+" : "-";
        console.log(`    - ${tx.date} ${sign}$${Math.abs(tx.amount).toFixed(2)} ${tx.name} [${tx.category?.join(", ")}]`);
      }
      if (data.transactions.length > 5) {
        console.log(`    ... and ${data.transactions.length - 5} more`);
      }
    }

    expect(data.accounts.length).toBeGreaterThan(0);
    // Sandbox may or may not have transactions depending on date range
    expect(data.accounts[0].balances).toBeDefined();
  }, 15000);

  it("computes a credit score from sandbox data", async () => {
    const data = await fetchPlaidData(accessToken);
    const score = computeCreditScore(data);

    console.log("\n  Credit Score Breakdown:");
    console.log(`    Balance Health:      ${score.balanceHealth}/250`);
    console.log(`    Income Stability:    ${score.incomeStability}/250`);
    console.log(`    Spending Discipline: ${score.spendingDiscipline}/250`);
    console.log(`    Account Age:         ${score.accountAge}/250`);
    console.log(`    ─────────────────────────────`);
    console.log(`    TOTAL:               ${score.total}/1000`);

    const tier =
      score.total >= 800 ? "Platinum (80% LTV)" :
      score.total >= 600 ? "Gold (120% LTV)" :
      score.total >= 400 ? "Silver (150% LTV)" :
      "Bronze (200% LTV)";
    console.log(`    Tier:                ${tier}`);

    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1000);
    expect(score.balanceHealth).toBeLessThanOrEqual(250);
    expect(score.incomeStability).toBeLessThanOrEqual(250);
    expect(score.spendingDiscipline).toBeLessThanOrEqual(250);
    expect(score.accountAge).toBeLessThanOrEqual(250);
  }, 15000);

  it("ABI-encodes the result and round-trips it", async () => {
    const data = await fetchPlaidData(accessToken);
    const score = computeCreditScore(data);
    const user = "0x1234567890AbcdEF1234567890aBcdef12345678";
    const timestamp = Math.floor(Date.now() / 1000);

    const encoded = encodeCreditScoreResult(user, score.total, timestamp);

    // Verify it decodes correctly (this is what the contract would see)
    const [decodedAddr, decodedScore, decodedTs] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    console.log(`\n  ABI-encoded result: ${encoded.slice(0, 66)}...`);
    console.log(`  Decoded: user=${decodedAddr} score=${decodedScore} ts=${decodedTs}`);

    expect(decodedAddr.toLowerCase()).toBe(user.toLowerCase());
    expect(Number(decodedScore)).toBe(score.total);
    expect(Number(decodedTs)).toBe(timestamp);
  }, 15000);

  it("full pipeline: sandbox token → Plaid data → score → ABI encode", async () => {
    // This simulates exactly what handleCreditScore() does,
    // minus the ECIES decrypt step (which requires a running TEE node)

    // 1. We already have the access token (simulating post-decrypt)
    // 2. Fetch Plaid data
    const plaidData = await fetchPlaidData(accessToken);

    // 3. Compute score
    const scoreResult = computeCreditScore(plaidData);

    // 4. ABI encode
    const user = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";
    const ts = Math.floor(Date.now() / 1000);
    const encoded = encodeCreditScoreResult(user, scoreResult.total, ts);

    console.log("\n  ✓ Full pipeline complete:");
    console.log(`    Accounts fetched:  ${plaidData.accounts.length}`);
    console.log(`    Transactions:      ${plaidData.transactions.length}`);
    console.log(`    Score:             ${scoreResult.total}/1000`);
    console.log(`    ABI data length:   ${encoded.length} chars`);

    expect(encoded).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(scoreResult.total).toBeGreaterThanOrEqual(0);
  }, 15000);
});
