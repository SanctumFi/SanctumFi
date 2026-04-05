import express from "express";
import cors from "cors";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Create a Plaid Link token for the frontend widget
app.post("/api/create_link_token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.user_id || "veil-user" },
      client_name: "Veil",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("create_link_token error:", err?.response?.data ?? err);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

// Exchange a public_token (from Plaid Link) for a permanent access_token
app.post("/api/exchange_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) return res.status(400).json({ error: "public_token required" });
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    res.json({ access_token: response.data.access_token });
  } catch (err) {
    console.error("exchange_token error:", err?.response?.data ?? err);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Veil score service running on http://localhost:${PORT}`)
);
