/**
 * Test all 4 credit score tiers using Plaid Sandbox with synthetic data overrides.
 *
 * Since Plaid Sandbox returns random data, we create real access tokens but then
 * test scoring with controlled PlaidData inputs to guarantee tier coverage.
 * We also test against each sandbox bank to see real score distribution.
 *
 * Run with:
 *   PLAID_CLIENT_ID=xxx PLAID_SECRET=yyy npm test -- plaid-tiers
 */

import { describe, it, expect, beforeAll } from "vitest";
import { fetchPlaidData, PlaidData } from "../app/plaid.js";
import { computeCreditScore } from "../app/scoring.js";
import { encodeCreditScoreResult } from "../app/abi.js";
import { decodeAbiParameters } from "viem";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_BASE_URL = "https://sandbox.plaid.com";

const hasCredentials = PLAID_CLIENT_ID.length > 0 && PLAID_SECRET.length > 0;
const describeOrSkip = hasCredentials ? describe : describe.skip;

async function createAccessToken(institutionId: string): Promise<string> {
  const pubRes = await fetch(`${PLAID_BASE_URL}/sandbox/public_token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      institution_id: institutionId,
      initial_products: ["transactions"],
    }),
  });
  if (!pubRes.ok) throw new Error(`public_token failed: ${await pubRes.text()}`);
  const { public_token } = await pubRes.json();

  const exchRes = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      public_token,
    }),
  });
  if (!exchRes.ok) throw new Error(`exchange failed: ${await exchRes.text()}`);
  const { access_token } = await exchRes.json();
  return access_token;
}

function tierName(score: number): string {
  if (score >= 800) return "Platinum (80% LTV)";
  if (score >= 600) return "Gold (120% LTV)";
  if (score >= 400) return "Silver (150% LTV)";
  return "Bronze (200% LTV)";
}

// ---------------------------------------------------------------------------
// Synthetic tier tests — controlled data guarantees each tier
// ---------------------------------------------------------------------------
describeOrSkip("Credit score tier coverage (synthetic data)", () => {
  it("Platinum (800-1000): wealthy, stable, disciplined saver", () => {
    const data: PlaidData = {
      accounts: [
        { account_id: "a1", balances: { available: 50000, current: 50000, iso_currency_code: "USD" }, name: "Checking", type: "depository", subtype: "checking" },
        { account_id: "a2", balances: { available: 120000, current: 120000, iso_currency_code: "USD" }, name: "Savings", type: "depository", subtype: "savings" },
      ],
      transactions: [
        // 12 months of very stable income
        { amount: -8000, date: "2025-04-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-05-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-06-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-07-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-08-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-09-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-10-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-11-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2025-12-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2026-01-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2026-02-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -8000, date: "2026-03-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        // Mostly essential spending
        { amount: 2000, date: "2026-01-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 2000, date: "2026-02-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 2000, date: "2026-03-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 600, date: "2026-01-10", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
        { amount: 600, date: "2026-02-10", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
        { amount: 600, date: "2026-03-10", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
        { amount: 200, date: "2026-01-15", name: "Utilities", category: ["Utilities"], transaction_type: "place" },
        { amount: 200, date: "2026-02-15", name: "Utilities", category: ["Utilities"], transaction_type: "place" },
        { amount: 200, date: "2026-03-15", name: "Utilities", category: ["Utilities"], transaction_type: "place" },
        { amount: 100, date: "2026-03-20", name: "Insurance", category: ["Insurance"], transaction_type: "place" },
      ],
    };

    const score = computeCreditScore(data);
    console.log(`\n  Platinum profile: ${score.total}/1000 [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`);
    expect(score.total).toBeGreaterThanOrEqual(800);
    expect(tierName(score.total)).toBe("Platinum (80% LTV)");
  });

  it("Gold (600-799): decent income, moderate savings, good habits", () => {
    const data: PlaidData = {
      accounts: [
        { account_id: "a1", balances: { available: 4000, current: 4200, iso_currency_code: "USD" }, name: "Checking", type: "depository", subtype: "checking" },
      ],
      transactions: [
        // Stable income but shorter history
        { amount: -4500, date: "2025-10-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -4500, date: "2025-11-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -4500, date: "2025-12-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -4500, date: "2026-01-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -4500, date: "2026-02-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        { amount: -4500, date: "2026-03-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
        // Mix of essential and discretionary
        { amount: 1500, date: "2026-01-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 1500, date: "2026-02-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 1500, date: "2026-03-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 400, date: "2026-01-10", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
        { amount: 400, date: "2026-02-10", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
        { amount: 300, date: "2026-01-20", name: "Shopping", category: ["Shops"], transaction_type: "place" },
        { amount: 250, date: "2026-02-20", name: "Entertainment", category: ["Entertainment"], transaction_type: "place" },
        { amount: 150, date: "2026-03-05", name: "Utilities", category: ["Utilities"], transaction_type: "place" },
      ],
    };

    const score = computeCreditScore(data);
    console.log(`  Gold profile:     ${score.total}/1000 [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`);
    expect(score.total).toBeGreaterThanOrEqual(600);
    expect(score.total).toBeLessThan(800);
    expect(tierName(score.total)).toBe("Gold (120% LTV)");
  });

  it("Silver (400-599): irregular income, some savings, mixed spending", () => {
    const data: PlaidData = {
      accounts: [
        { account_id: "a1", balances: { available: 2500, current: 2700, iso_currency_code: "USD" }, name: "Checking", type: "depository", subtype: "checking" },
      ],
      transactions: [
        // Irregular freelance income
        { amount: -6000, date: "2026-01-10", name: "Client Payment", category: ["Transfer"], transaction_type: "special" },
        { amount: -2000, date: "2026-02-20", name: "Client Payment", category: ["Transfer"], transaction_type: "special" },
        { amount: -4500, date: "2026-03-05", name: "Client Payment", category: ["Transfer"], transaction_type: "special" },
        // Heavy discretionary, some essential
        { amount: 1200, date: "2026-01-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 1200, date: "2026-02-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 1200, date: "2026-03-01", name: "Rent", category: ["Rent"], transaction_type: "place" },
        { amount: 800, date: "2026-01-15", name: "Shopping Spree", category: ["Shops"], transaction_type: "place" },
        { amount: 500, date: "2026-02-10", name: "Travel", category: ["Travel"], transaction_type: "place" },
        { amount: 600, date: "2026-03-10", name: "Electronics", category: ["Shops"], transaction_type: "place" },
        { amount: 200, date: "2026-01-20", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
      ],
    };

    const score = computeCreditScore(data);
    console.log(`  Silver profile:   ${score.total}/1000 [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`);
    expect(score.total).toBeGreaterThanOrEqual(400);
    expect(score.total).toBeLessThan(600);
    expect(tierName(score.total)).toBe("Silver (150% LTV)");
  });

  it("Bronze (0-399): low balance, no income pattern, all discretionary", () => {
    const data: PlaidData = {
      accounts: [
        { account_id: "a1", balances: { available: 150, current: 200, iso_currency_code: "USD" }, name: "Checking", type: "depository", subtype: "checking" },
        { account_id: "a2", balances: { available: 0, current: 3500, iso_currency_code: "USD" }, name: "Credit Card", type: "credit", subtype: "credit card" },
      ],
      transactions: [
        // Single lump income, no pattern
        { amount: -2000, date: "2026-02-28", name: "Deposit", category: ["Transfer"], transaction_type: "special" },
        // All discretionary spending
        { amount: 500, date: "2026-03-01", name: "Online Shopping", category: ["Shops", "Online"], transaction_type: "place" },
        { amount: 300, date: "2026-03-05", name: "Bar Tab", category: ["Entertainment", "Nightlife"], transaction_type: "place" },
        { amount: 400, date: "2026-03-10", name: "Concert Tickets", category: ["Entertainment"], transaction_type: "place" },
        { amount: 250, date: "2026-03-15", name: "Restaurant", category: ["Restaurants"], transaction_type: "place" },
        { amount: 350, date: "2026-03-20", name: "Clothing", category: ["Shops", "Clothing"], transaction_type: "place" },
      ],
    };

    const score = computeCreditScore(data);
    console.log(`  Bronze profile:   ${score.total}/1000 [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`);
    expect(score.total).toBeLessThan(400);
    expect(tierName(score.total)).toBe("Bronze (200% LTV)");
  });
});

// ---------------------------------------------------------------------------
// Live sandbox banks — see what real Plaid Sandbox data scores
// ---------------------------------------------------------------------------
describeOrSkip("Live scores across sandbox banks", () => {
  const banks = [
    { id: "ins_109508", name: "First Platypus Bank" },
    { id: "ins_109509", name: "First Gingham Credit Union" },
    { id: "ins_109510", name: "Tattersall Federal Credit Union" },
    { id: "ins_109511", name: "Tartan Bank" },
  ];

  for (const bank of banks) {
    it(`${bank.name} (${bank.id})`, async () => {
      const token = await createAccessToken(bank.id);
      const data = await fetchPlaidData(token);
      const score = computeCreditScore(data);

      const encoded = encodeCreditScoreResult(
        "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
        score.total,
        Math.floor(Date.now() / 1000)
      );

      // Verify ABI round-trip
      const [, decodedScore] = decodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
        encoded as `0x${string}`
      );

      console.log(
        `\n  ${bank.name}: ${score.total}/1000 → ${tierName(score.total)}` +
        `\n    [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]` +
        `\n    Accounts: ${data.accounts.length}, Transactions: ${data.transactions.length}`
      );

      expect(Number(decodedScore)).toBe(score.total);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(1000);
    }, 20000);
  }
});
