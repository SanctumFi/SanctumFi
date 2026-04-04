import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import { Server } from "../base/server.js";
import { VERSION } from "../app/config.js";
import { register, reportState, setSignPort } from "../app/handlers.js";
import { stringToBytes32Hex } from "../base/types.js";
import { bytesToHex } from "../base/encoding.js";
import { decodeAbiParameters } from "viem";

// ---------------------------------------------------------------------------
// Mock TEE decrypt server — returns the "decrypted" plaintext as-is
// ---------------------------------------------------------------------------
let mockDecryptServer: http.Server;
const MOCK_SIGN_PORT = "19090";

// The payload the "encrypted" message will decrypt to
const MOCK_USER = "0x1234567890AbcdEF1234567890aBcdef12345678";
const MOCK_PAYLOAD = {
  plaid_access_token: "access-sandbox-test",
  user_address: MOCK_USER,
};

function startMockDecryptServer(): Promise<void> {
  return new Promise((resolve) => {
    mockDecryptServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        // The handler sends base64-encoded ciphertext; we "decrypt" by returning
        // the mock payload as base64-encoded JSON bytes.
        const plaintextBytes = Buffer.from(
          JSON.stringify(MOCK_PAYLOAD),
          "utf-8"
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            decryptedMessage: plaintextBytes.toString("base64"),
          })
        );
      });
    });
    mockDecryptServer.listen(parseInt(MOCK_SIGN_PORT), resolve);
  });
}

// ---------------------------------------------------------------------------
// Mock Plaid API — intercept global fetch
// ---------------------------------------------------------------------------
const MOCK_PLAID_ACCOUNTS = {
  accounts: [
    {
      account_id: "acc1",
      balances: { available: 5000, current: 5200, iso_currency_code: "USD" },
      name: "Checking",
      type: "depository",
      subtype: "checking",
    },
  ],
};

const MOCK_PLAID_TRANSACTIONS = {
  transactions: [
    { amount: -3000, date: "2026-01-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
    { amount: -3000, date: "2026-02-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
    { amount: -3000, date: "2026-03-15", name: "Payroll", category: ["Transfer", "Payroll"], transaction_type: "special" },
    { amount: 1200, date: "2026-01-05", name: "Rent", category: ["Rent"], transaction_type: "place" },
    { amount: 150, date: "2026-01-10", name: "Electric", category: ["Utilities"], transaction_type: "place" },
    { amount: 400, date: "2026-01-20", name: "Groceries", category: ["Groceries"], transaction_type: "place" },
  ],
};

const originalFetch = globalThis.fetch;

function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("sandbox.plaid.com/accounts/balance/get")) {
    return Promise.resolve(new Response(JSON.stringify(MOCK_PLAID_ACCOUNTS), { status: 200 }));
  }
  if (url.includes("sandbox.plaid.com/transactions/get")) {
    return Promise.resolve(new Response(JSON.stringify(MOCK_PLAID_TRANSACTIONS), { status: 200 }));
  }
  // Pass through for non-Plaid requests
  return originalFetch(input, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("TEE extension integration", () => {
  let server: Server;

  beforeAll(async () => {
    // Mock fetch for Plaid
    globalThis.fetch = mockFetch as typeof fetch;

    // Start mock decrypt server
    await startMockDecryptServer();
    setSignPort(MOCK_SIGN_PORT);

    // Start extension server
    server = new Server("18083", MOCK_SIGN_PORT, VERSION, register, reportState);
    await server.listenAndServe();
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await server.close();
    await new Promise<void>((resolve) => mockDecryptServer.close(() => resolve()));
  });

  it("GET /state returns version and state", async () => {
    const [status, body] = await server.handleRequestDirect("GET", "/state", "");
    expect(status).toBe(200);

    const resp = body as { stateVersion: string; state: { version: string } };
    expect(resp.state.version).toBe(VERSION);
  });

  it("POST /action with CREDIT/SCORE returns a valid score", async () => {
    // Build a DataFixed-like message
    const dataFixed = {
      instructionId: "0x" + "ab".repeat(32),
      teeId: "0x" + "cd".repeat(20),
      timestamp: Math.floor(Date.now() / 1000),
      opType: stringToBytes32Hex("CREDIT"),
      opCommand: stringToBytes32Hex("SCORE"),
      originalMessage: bytesToHex(new TextEncoder().encode("fake-ciphertext")),
    };

    const actionDataMessage = bytesToHex(
      new TextEncoder().encode(JSON.stringify(dataFixed))
    );

    const action = {
      data: {
        id: "0x" + "01".repeat(32),
        type: "instruction",
        submissionTag: "submit",
        message: actionDataMessage,
      },
    };

    const [status, body] = await server.handleRequestDirect(
      "POST",
      "/action",
      JSON.stringify(action)
    );

    expect(status).toBe(200);

    const result = body as {
      id: string;
      status: number;
      data?: string;
      log?: string;
      opType: string;
      opCommand: string;
      version: string;
    };

    expect(result.status).toBe(1);
    expect(result.log).toBe("ok");
    expect(result.data).toBeDefined();

    // Decode the ABI-encoded result
    const [decodedAddr, decodedScore, decodedTs] = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      result.data as `0x${string}`
    );

    expect(decodedAddr.toLowerCase()).toBe(MOCK_USER.toLowerCase());
    expect(Number(decodedScore)).toBeGreaterThanOrEqual(0);
    expect(Number(decodedScore)).toBeLessThanOrEqual(1000);
    expect(Number(decodedTs)).toBeGreaterThan(0);
  });

  it("POST /action with unknown opType returns 501", async () => {
    const dataFixed = {
      instructionId: "0x" + "ab".repeat(32),
      teeId: "0x" + "cd".repeat(20),
      timestamp: Math.floor(Date.now() / 1000),
      opType: stringToBytes32Hex("UNKNOWN"),
      opCommand: stringToBytes32Hex("NOPE"),
    };

    const actionDataMessage = bytesToHex(
      new TextEncoder().encode(JSON.stringify(dataFixed))
    );

    const action = {
      data: {
        id: "0x" + "02".repeat(32),
        type: "instruction",
        submissionTag: "submit",
        message: actionDataMessage,
      },
    };

    const [status] = await server.handleRequestDirect(
      "POST",
      "/action",
      JSON.stringify(action)
    );

    expect(status).toBe(501);
  });

  it("state reflects last computed score after action", async () => {
    const [, body] = await server.handleRequestDirect("GET", "/state", "");
    const resp = body as { state: { lastScore: { address: string; score: number } | null } };

    // After the successful action above, lastScore should be populated
    expect(resp.state.lastScore).not.toBeNull();
    expect(resp.state.lastScore!.address.toLowerCase()).toBe(MOCK_USER.toLowerCase());
    expect(resp.state.lastScore!.score).toBeGreaterThan(0);
  });
});
