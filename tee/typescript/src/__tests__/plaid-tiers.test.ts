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
// Live sandbox profiles — fetch real Plaid data then apply realistic
// financial transformations to simulate different user profiles.
// ---------------------------------------------------------------------------
describeOrSkip("Live sandbox: simulated user profiles", () => {
  let baseData: PlaidData;

  beforeAll(async () => {
    const token = await createAccessToken("ins_109508");
    baseData = await fetchPlaidData(token);
    console.log(`\n  Fetched base sandbox data: ${baseData.accounts.length} accounts, ${baseData.transactions.length} transactions`);
  }, 20000);

  function cloneData(data: PlaidData): PlaidData {
    return JSON.parse(JSON.stringify(data));
  }

  it("Platinum: high earner with big savings (sandbox data + boosted balances + salary deposits)", () => {
    const data = cloneData(baseData);

    // Boost depository balances to simulate wealthy user
    for (const acc of data.accounts) {
      if (acc.type === "depository") {
        acc.balances.available = (acc.balances.available || 0) * 50 + 30000;
        acc.balances.current = acc.balances.available;
      }
    }

    // Add 12 months of stable high salary
    const months = ["2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
                     "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
    for (const m of months) {
      data.transactions.push({
        amount: -12000, date: `${m}-01`, name: "Direct Deposit - Employer",
        category: null,
        personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES", confidence_level: "HIGH" },
        transaction_type: "special",
      });
    }

    // Add heavy essential spending to dominate the discipline ratio
    for (const m of ["2026-01", "2026-02", "2026-03"]) {
      data.transactions.push(
        { amount: 3000, date: `${m}-01`, name: "Rent Payment", category: null,
          personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT", confidence_level: "HIGH" },
          transaction_type: "place" },
        { amount: 800, date: `${m}-10`, name: "Groceries", category: null,
          personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES", confidence_level: "HIGH" },
          transaction_type: "place" },
        { amount: 500, date: `${m}-15`, name: "Insurance", category: null,
          personal_finance_category: { primary: "INSURANCE", detailed: "INSURANCE_AUTO", confidence_level: "HIGH" },
          transaction_type: "place" },
      );
    }

    const score = computeCreditScore(data);
    const encoded = encodeCreditScoreResult("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF", score.total, Math.floor(Date.now() / 1000));
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    console.log(
      `\n  Platinum (boosted): ${score.total}/1000 → ${tierName(score.total)}` +
      `\n    [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`
    );

    expect(Number(decodedScore)).toBe(score.total);
    expect(score.total).toBeGreaterThanOrEqual(800);
  });

  it("Gold: stable income, moderate savings (sandbox data + salary normalization)", () => {
    const data = cloneData(baseData);

    // Boost checking balance for solid balance health
    for (const acc of data.accounts) {
      if (acc.type === "depository" && acc.subtype === "checking") {
        acc.balances.available = 15000;
        acc.balances.current = 15200;
      }
    }

    // Add 6 months of stable mid-range salary
    const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
    for (const m of months) {
      data.transactions.push({
        amount: -5500, date: `${m}-15`, name: "Payroll",
        category: null,
        personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES", confidence_level: "HIGH" },
        transaction_type: "special",
      });
    }

    // Add essential spending to push discipline up
    for (const m of ["2026-01", "2026-02", "2026-03"]) {
      data.transactions.push(
        { amount: 1800, date: `${m}-01`, name: "Rent Payment", category: null,
          personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT", confidence_level: "HIGH" },
          transaction_type: "place" },
        { amount: 400, date: `${m}-10`, name: "Groceries", category: null,
          personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES", confidence_level: "HIGH" },
          transaction_type: "place" },
      );
    }

    const score = computeCreditScore(data);
    const encoded = encodeCreditScoreResult("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF", score.total, Math.floor(Date.now() / 1000));
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    console.log(
      `\n  Gold (moderate):   ${score.total}/1000 → ${tierName(score.total)}` +
      `\n    [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`
    );

    expect(Number(decodedScore)).toBe(score.total);
    expect(score.total).toBeGreaterThanOrEqual(600);
    expect(score.total).toBeLessThan(800);
  });

  it("Silver: raw sandbox data as-is (average profile)", () => {
    const data = cloneData(baseData);
    const score = computeCreditScore(data);

    const encoded = encodeCreditScoreResult("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF", score.total, Math.floor(Date.now() / 1000));
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    console.log(
      `\n  Silver (raw data): ${score.total}/1000 → ${tierName(score.total)}` +
      `\n    [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`
    );

    expect(Number(decodedScore)).toBe(score.total);
    expect(score.total).toBeGreaterThanOrEqual(400);
    expect(score.total).toBeLessThan(600);
  });

  it("Bronze: stripped down sandbox data (struggling profile)", () => {
    const data = cloneData(baseData);

    // Keep only credit card accounts, drop depository
    data.accounts = data.accounts.filter((a) => a.type !== "depository");
    // Add a near-empty checking account
    data.accounts.push({
      account_id: "broke",
      balances: { available: 45, current: 45, iso_currency_code: "USD" },
      name: "Checking", type: "depository", subtype: "checking",
    });

    // Remove all income transactions (negative amounts)
    data.transactions = data.transactions.filter((t) => t.amount > 0);

    // Add only discretionary spending
    for (const d of ["2026-03-01", "2026-03-10", "2026-03-18"]) {
      data.transactions.push({
        amount: 350, date: d, name: "Online Shopping",
        category: null,
        personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", confidence_level: "LOW" },
        transaction_type: "place",
      });
    }

    const score = computeCreditScore(data);
    const encoded = encodeCreditScoreResult("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF", score.total, Math.floor(Date.now() / 1000));
    const [, decodedScore] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      encoded as `0x${string}`
    );

    console.log(
      `\n  Bronze (stripped): ${score.total}/1000 → ${tierName(score.total)}` +
      `\n    [BH:${score.balanceHealth} IS:${score.incomeStability} SD:${score.spendingDiscipline} AA:${score.accountAge}]`
    );

    expect(Number(decodedScore)).toBe(score.total);
    expect(score.total).toBeLessThan(400);
  });
});
