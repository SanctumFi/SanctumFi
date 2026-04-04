import { describe, it, expect } from "vitest";
import { computeCreditScore, ScoreBreakdown } from "../app/scoring.js";
import { PlaidData } from "../app/plaid.js";

function makePlaidData(overrides?: Partial<PlaidData>): PlaidData {
  return {
    accounts: overrides?.accounts ?? [
      {
        account_id: "acc1",
        balances: { available: 5000, current: 5200, iso_currency_code: "USD" },
        name: "Checking",
        type: "depository",
        subtype: "checking",
      },
    ],
    transactions: overrides?.transactions ?? [
      // Income (negative amounts in Plaid)
      { amount: -3000, date: "2026-01-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
      { amount: -3000, date: "2026-02-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
      { amount: -3000, date: "2026-03-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
      // Essential spending
      { amount: 1200, date: "2026-01-05", name: "Rent", category: ["Rent"], transaction_type: "place" },
      { amount: 150, date: "2026-01-10", name: "Electric", category: ["Utilities"], transaction_type: "place" },
      { amount: 400, date: "2026-01-20", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
      // Discretionary
      { amount: 200, date: "2026-02-05", name: "Restaurant", category: ["Food and Drink", "Restaurants"], transaction_type: "place" },
      { amount: 100, date: "2026-03-01", name: "Shopping", category: ["Shops"], transaction_type: "place" },
    ],
  };
}

describe("computeCreditScore", () => {
  it("returns a total between 0 and 1000", () => {
    const result = computeCreditScore(makePlaidData());
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1000);
  });

  it("returns 4 sub-scores each capped at 250", () => {
    const result = computeCreditScore(makePlaidData());
    expect(result.balanceHealth).toBeLessThanOrEqual(250);
    expect(result.incomeStability).toBeLessThanOrEqual(250);
    expect(result.spendingDiscipline).toBeLessThanOrEqual(250);
    expect(result.accountAge).toBeLessThanOrEqual(250);
  });

  it("total equals sum of sub-scores", () => {
    const result = computeCreditScore(makePlaidData());
    expect(result.total).toBe(
      result.balanceHealth +
        result.incomeStability +
        result.spendingDiscipline +
        result.accountAge
    );
  });

  it("healthy profile scores high", () => {
    const result = computeCreditScore(makePlaidData());
    // Stable income, good balance, mostly essential spending
    expect(result.balanceHealth).toBeGreaterThan(100);
    expect(result.incomeStability).toBeGreaterThan(200);
    expect(result.spendingDiscipline).toBeGreaterThan(150);
  });

  it("empty transactions yields low score", () => {
    const result = computeCreditScore(
      makePlaidData({ transactions: [] })
    );
    expect(result.incomeStability).toBe(125); // default for < 2 months
    expect(result.accountAge).toBe(0);
    expect(result.spendingDiscipline).toBe(250); // no spending = disciplined
  });

  it("no depository accounts yields zero balance health", () => {
    const result = computeCreditScore(
      makePlaidData({
        accounts: [
          {
            account_id: "cc1",
            balances: { available: 0, current: 1000, iso_currency_code: "USD" },
            name: "Credit Card",
            type: "credit",
            subtype: "credit card",
          },
        ],
      })
    );
    expect(result.balanceHealth).toBe(0);
  });

  it("volatile income scores low on stability", () => {
    const result = computeCreditScore(
      makePlaidData({
        transactions: [
          { amount: -10000, date: "2026-01-15", name: "Payroll", category: ["Transfer"], transaction_type: "special" },
          { amount: -500, date: "2026-02-15", name: "Payroll", category: ["Transfer"], transaction_type: "special" },
          { amount: -8000, date: "2026-03-15", name: "Payroll", category: ["Transfer"], transaction_type: "special" },
          { amount: 500, date: "2026-01-20", name: "Rent", category: ["Rent"], transaction_type: "place" },
        ],
      })
    );
    expect(result.incomeStability).toBeLessThan(150);
  });

  it("all discretionary spending scores low on discipline", () => {
    const result = computeCreditScore(
      makePlaidData({
        transactions: [
          { amount: -3000, date: "2026-01-15", name: "Payroll", category: ["Transfer"], transaction_type: "special" },
          { amount: 500, date: "2026-01-20", name: "Shopping", category: ["Shops"], transaction_type: "place" },
          { amount: 300, date: "2026-02-05", name: "Entertainment", category: ["Entertainment"], transaction_type: "place" },
          { amount: 200, date: "2026-03-10", name: "Travel", category: ["Travel"], transaction_type: "place" },
        ],
      })
    );
    expect(result.spendingDiscipline).toBe(0);
  });
});
