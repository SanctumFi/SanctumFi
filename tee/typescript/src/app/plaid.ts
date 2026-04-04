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

export interface PlaidTransaction {
  amount: number;
  date: string;
  name: string;
  category: string[];
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

export async function fetchPlaidData(accessToken: string): Promise<PlaidData> {
  const balanceRes = await plaidRequest("/accounts/balance/get", {
    access_token: accessToken,
  });

  const now = new Date();
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const txRes = await plaidRequest("/transactions/get", {
    access_token: accessToken,
    start_date: startDate.toISOString().split("T")[0],
    end_date: now.toISOString().split("T")[0],
    options: { count: 500 },
  });

  return {
    accounts: balanceRes.accounts,
    transactions: txRes.transactions,
  };
}
