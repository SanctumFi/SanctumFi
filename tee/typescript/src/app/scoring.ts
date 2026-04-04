/** Credit score computation engine — 4-factor weighted score (0–1000). */

import { PlaidData } from "./plaid.js";

export interface ScoreBreakdown {
  balanceHealth: number;
  incomeStability: number;
  spendingDiscipline: number;
  accountAge: number;
  total: number;
}

export function computeCreditScore(data: PlaidData): ScoreBreakdown {
  const balanceHealth = scoreBalanceHealth(data);
  const incomeStability = scoreIncomeStability(data);
  const spendingDiscipline = scoreSpendingDiscipline(data);
  const accountAge = scoreAccountAge(data);

  return {
    balanceHealth,
    incomeStability,
    spendingDiscipline,
    accountAge,
    total: balanceHealth + incomeStability + spendingDiscipline + accountAge,
  };
}

/** Balance health (max 250): avg available balance / monthly spend ratio. */
function scoreBalanceHealth(data: PlaidData): number {
  const depository = data.accounts.filter((a) => a.type === "depository");
  if (depository.length === 0) return 0;

  const avgBalance =
    depository.reduce((sum, a) => sum + (a.balances.available || 0), 0) /
    depository.length;

  const totalSpend = data.transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlySpend = totalSpend / 3;
  if (monthlySpend === 0) return 250;

  const ratio = avgBalance / monthlySpend;
  return Math.min(250, Math.round((ratio / 3) * 250));
}

/** Income stability (max 250): coefficient of variation of monthly income. */
function scoreIncomeStability(data: PlaidData): number {
  const incomeByMonth: Record<string, number> = {};

  data.transactions
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      const month = t.date.substring(0, 7);
      incomeByMonth[month] = (incomeByMonth[month] || 0) + Math.abs(t.amount);
    });

  const months = Object.values(incomeByMonth);
  if (months.length < 2) return 125;

  const mean = months.reduce((a, b) => a + b, 0) / months.length;
  if (mean === 0) return 0;

  const variance =
    months.reduce((sum, m) => sum + (m - mean) ** 2, 0) / months.length;
  const cv = Math.sqrt(variance) / mean;

  return Math.max(0, Math.min(250, Math.round((1 - cv) * 250)));
}

/** Spending discipline (max 250): essential vs total spending ratio. */
function scoreSpendingDiscipline(data: PlaidData): number {
  const spending = data.transactions.filter((t) => t.amount > 0);
  if (spending.length === 0) return 250;

  const essentialCategories = [
    "Rent",
    "Mortgage",
    "Utilities",
    "Groceries",
    "Insurance",
    "Transfer",
    "Payment",
    "Food and Drink",
  ];

  const essentialSpend = spending
    .filter((t) =>
      t.category?.some((c) =>
        essentialCategories.some((e) => c.includes(e))
      )
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpend = spending.reduce((sum, t) => sum + t.amount, 0);
  if (totalSpend === 0) return 250;

  const ratio = essentialSpend / totalSpend;
  return Math.min(250, Math.round((ratio / 0.7) * 250));
}

/** Account age (max 250): months of transaction history, capped at 24. */
function scoreAccountAge(data: PlaidData): number {
  if (data.transactions.length === 0) return 0;

  const dates = data.transactions.map((t) => new Date(t.date).getTime());
  const oldest = Math.min(...dates);
  const newest = Math.max(...dates);
  const monthsOfHistory = (newest - oldest) / (30 * 24 * 60 * 60 * 1000);

  return Math.min(250, Math.round((monthsOfHistory / 24) * 250));
}
