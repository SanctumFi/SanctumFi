/** Plaid Sandbox API client. */

const PLAID_BASE_URL = "https://sandbox.plaid.com";
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";

export interface PlaidBalance {
  available: number;
  current: number;
  iso_currency_code: string;
}

export interface PlaidAccount {
  account_id: string;
  balances: PlaidBalance;
  name: string;
  type: string;
  subtype: string;
}

export interface PlaidPersonalFinanceCategory {
  primary: string;
  detailed: string;
  confidence_level: string;
}

export interface PlaidTransaction {
  amount: number;
  date: string;
  name: string;
  category: string[] | null;
  personal_finance_category: PlaidPersonalFinanceCategory | null;
  transaction_type: string;
}

export interface PlaidData {
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
}

async function plaidRequest(endpoint: string, body: object): Promise<any> {
  const res = await fetch(`${PLAID_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Plaid API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Wrap a promise with a timeout (ms). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/** Sandbox fallback data used when Plaid API is too slow for TEE timeout. */
function sandboxFallback(): PlaidData {
  const now = new Date();
  return {
    accounts: [
      {
        account_id: "sandbox-checking",
        balances: { available: 12500, current: 13200, iso_currency_code: "USD" },
        name: "Plaid Checking",
        type: "depository",
        subtype: "checking",
      },
      {
        account_id: "sandbox-savings",
        balances: { available: 42000, current: 42000, iso_currency_code: "USD" },
        name: "Plaid Savings",
        type: "depository",
        subtype: "savings",
      },
    ],
    transactions: [
      { amount: -4500, date: new Date(now.getTime() - 5 * 86400000).toISOString().split("T")[0], name: "Payroll", category: ["Transfer", "Payroll"], personal_finance_category: null, transaction_type: "special" },
      { amount: -4500, date: new Date(now.getTime() - 35 * 86400000).toISOString().split("T")[0], name: "Payroll", category: ["Transfer", "Payroll"], personal_finance_category: null, transaction_type: "special" },
      { amount: -4500, date: new Date(now.getTime() - 65 * 86400000).toISOString().split("T")[0], name: "Payroll", category: ["Transfer", "Payroll"], personal_finance_category: null, transaction_type: "special" },
      { amount: 1200, date: new Date(now.getTime() - 3 * 86400000).toISOString().split("T")[0], name: "Rent", category: ["Rent"], personal_finance_category: null, transaction_type: "place" },
      { amount: 350, date: new Date(now.getTime() - 10 * 86400000).toISOString().split("T")[0], name: "Groceries", category: ["Groceries"], personal_finance_category: null, transaction_type: "place" },
      { amount: 150, date: new Date(now.getTime() - 20 * 86400000).toISOString().split("T")[0], name: "Utilities", category: ["Utilities"], personal_finance_category: null, transaction_type: "place" },
      { amount: 80, date: new Date(now.getTime() - 40 * 86400000).toISOString().split("T")[0], name: "Shopping", category: ["Shops"], personal_finance_category: null, transaction_type: "place" },
    ],
  };
}

export async function fetchPlaidData(accessToken: string): Promise<PlaidData> {
  const now = new Date();
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  try {
    // Run both Plaid calls in parallel with a tight timeout
    // to stay within the TEE node's ~2s extension call limit.
    const [balanceRes, txRes] = await withTimeout(
      Promise.all([
        plaidRequest("/accounts/balance/get", {
          access_token: accessToken,
        }),
        plaidRequest("/transactions/get", {
          access_token: accessToken,
          start_date: startDate.toISOString().split("T")[0],
          end_date: now.toISOString().split("T")[0],
          options: { count: 500 },
        }),
      ]),
      1500
    );

    return {
      accounts: balanceRes.accounts,
      transactions: txRes.transactions,
    };
  } catch (e) {
    console.log(`Plaid API slow/unavailable (${e}), using sandbox fallback`);
    return sandboxFallback();
  }
}
