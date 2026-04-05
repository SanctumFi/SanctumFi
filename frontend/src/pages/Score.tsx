import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useCreditScore } from "../hooks/useCreditScore";
import { usePosition } from "../hooks/usePosition";
import { ScoreDisplay } from "../components/ScoreDisplay";

// Routed through Vite proxy to avoid CORS (sandbox.plaid.com blocks direct browser calls)
const PLAID_BASE = "/plaid-sandbox";
const PLAID_CLIENT_ID = import.meta.env.PLAID_CLIENT_ID as string;
const PLAID_SECRET = import.meta.env.PLAID_SECRET as string;

async function createLinkToken(userId: string): Promise<string> {
  const resp = await fetch(`${PLAID_BASE}/link/token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      client_name: "Veil",
      user: { client_user_id: userId },
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    }),
  });
  if (!resp.ok) throw new Error("Failed to create Plaid link token");
  const data = await resp.json();
  return data.link_token;
}

async function exchangePublicToken(publicToken: string): Promise<string> {
  const resp = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      public_token: publicToken,
    }),
  });
  if (!resp.ok) throw new Error("Failed to exchange Plaid token");
  const data = await resp.json();
  return data.access_token;
}

interface Props {
  xrplAddress: string;
  personalAccount: `0x${string}` | null;
}

export function Score({ xrplAddress: _xrplAddress, personalAccount }: Props) {
  const { requestScore, requesting, status, error } = useCreditScore(personalAccount);
  const { position } = usePosition(personalAccount);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidPending, setPlaidPending] = useState(false);
  const [plaidError, setPlaidError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken) => {
      try {
        const accessToken = await exchangePublicToken(publicToken);
        await requestScore(accessToken);
      } catch (e: unknown) {
        setPlaidError(e instanceof Error ? e.message : "Failed to connect bank");
      } finally {
        setLinkToken(null);
        setPlaidPending(false);
      }
    },
    onExit: () => {
      setLinkToken(null);
      setPlaidPending(false);
    },
  });

  // Open Plaid widget as soon as the link token is ready
  useEffect(() => {
    if (ready && linkToken && plaidPending) {
      open();
    }
  }, [ready, linkToken, plaidPending, open]);

  async function handleRequestScore() {
    setPlaidError(null);
    setPlaidPending(true);
    try {
      const token = await createLinkToken(personalAccount ?? "sanctumfi-user");
      setLinkToken(token);
    } catch (e: unknown) {
      setPlaidError(e instanceof Error ? e.message : "Failed to open bank widget");
      setPlaidPending(false);
    }
  }

  const hasScore = position && position.creditScore > 0n;
  const isBusy = plaidPending || requesting;

  return (
    <div>
      {/* Score monument */}
      {hasScore && (
        <div className="reveal">
          <ScoreDisplay score={Number(position.creditScore)} />
        </div>
      )}

      {/* Action module */}
      <div
        className={`veil-module reveal${hasScore ? " delay-1" : ""}`}
        style={{ marginTop: hasScore ? "48px" : "0" }}
      >
        {/* Section label */}
        <p className="section-num">
          {hasScore ? "II." : "I."}
        </p>

        <h2
          className=""
          style={{
            fontSize: "28px",
            fontWeight: 300,
            color: "var(--c-ink)",
            margin: "0 0 16px",
            lineHeight: 1.1,
          }}
        >
          {hasScore ? "Update your Score" : "Compute your Credit Score"}
        </h2>

        <p
          style={{
            fontSize: "16px",
            color: "var(--c-slate)",
            maxWidth: "480px",
            lineHeight: 1.75,
            margin: "0 0 40px",
          }}
        >
          Your banking data is processed privately inside a Trusted Execution
          Environment. Only the resulting score is published on-chain — raw
          financial data never touches the blockchain.
        </p>

        <button
          className="btn-veil"
          onClick={handleRequestScore}
          disabled={isBusy}
        >
          <span>
            {plaidPending && !requesting
              ? "Connecting bank\u2026"
              : requesting
                ? "Processing\u2026"
                : hasScore
                  ? "Update Credit Score"
                  : "Compute Credit Score"}
          </span>
        </button>

        {(status || (plaidPending && !requesting)) && (
          <p style={{ fontSize: "11px", color: "var(--c-slate)", marginTop: "16px" }}>
            {status ?? "Waiting for bank connection\u2026"}
          </p>
        )}

        {(error || plaidError) && (
          <p className="error-text">{error ?? plaidError}</p>
        )}
      </div>
    </div>
  );
}
