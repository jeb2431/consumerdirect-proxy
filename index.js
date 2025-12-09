import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Internal shared secret used to authorize calls from your backend (Base44)
const INTERNAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

// ConsumerDirect config
const CD_BASE_URL = process.env.CD_BASE_URL || "https://papi.consumerdirect.io";
const CD_CLIENT_ID = process.env.CD_CLIENT_ID;
const CD_CLIENT_SECRET = process.env.CD_CLIENT_SECRET;

if (!INTERNAL_SECRET) {
  console.error("Missing INTERNAL_SHARED_SECRET env var");
  process.exit(1);
}

if (!CD_CLIENT_ID || !CD_CLIENT_SECRET) {
  console.error("Missing CD_CLIENT_ID or CD_CLIENT_SECRET env vars");
  process.exit(1);
}

// Health check (requires internal secret so it isn't public)
app.get("/health", (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ status: "ok" });
});

// Get JWT token from ConsumerDirect (OAuth2 client_credentials)
async function getAccessToken() {
  const authResponse = await axios.post(
    "https://auth.consumerdirect.io/oauth2/token",
    "grant_type=client_credentials&scope=target-entity:e6c9113e-48b8-41ef-a87e-87a3c51a5e83",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${CD_CLIENT_ID}:${CD_CLIENT_SECRET}`).toString("base64"),
      },
    }
  );

  return authResponse.data.access_token;
}

// ---------------------------------------------------------------------------
// 1) Get credit score for a specific customerToken
//    Proxies to: GET /v1/customers/{customerToken}/credit-scores
// ---------------------------------------------------------------------------
app.post("/consumerdirect/get-credit-score", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { customerToken } = req.body;

    if (!customerToken) {
      return res.status(400).json({ error: "customerToken is required" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers/${customerToken}/credit-scores`;

    console.log("CD get-credit-score outbound request:", { url });

    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect get-credit-score error:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "ConsumerDirect get-credit-score failed",
      details: error.response?.data || { message: error.message },
    });
  }
});

// ---------------------------------------------------------------------------
// 2) Get customers (search/list existing customers under your PID)
//    Proxies to: GET /v1/customers with query params
//    Body from Base44 (JSON) becomes query string: { email, lastName, pid, ... }
// ---------------------------------------------------------------------------
app.post("/consumerdirect/get-customers", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const filters = req.body || {};

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    }

    const url =
      params.toString().length > 0
        ? `${CD_BASE_URL}/v1/customers?${params.toString()}`
        : `${CD_BASE_URL}/v1/customers`;

    console.log("CD get-customers outbound request:", {
      url,
      params: filters,
    });

    const accessToken = await getAccessToken();

    const response = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect get-customers error:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "ConsumerDirect get-customers failed",
      details: error.response?.data || { message: error.message },
    });
  }
});

// ---------------------------------------------------------------------------
// 3) Login-As (agent login-as customer)
//    This is a shell following the Login-As docs. The exact URL/payload can be
//    adjusted by Bass44 to match the official spec, but this gives them a
//    working endpoint on the proxy.
//    Example assumption: POST /v1/customers/{customerToken}/login-as
// ---------------------------------------------------------------------------
app.post("/consumerdirect/login-as", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body || {};
    const { customerToken } = body;

    if (!customerToken) {
      return res
        .status(400)
        .json({ error: "customerToken is required for login-as" });
    }

    const accessToken = await getAccessToken();

    // NOTE: If ConsumerDirect's docs say a different path or require specific
    // body fields (e.g., pid, returnUrl, etc.), Bass44 can update this URL + body.
    const url = `${CD_BASE_URL}/v1/customers/${customerToken}/login-as`;

    console.log("CD login-as outbound request:", {
      url,
      body,
    });

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect login-as error:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "ConsumerDirect login-as failed",
      details: error.response?.data || { message: error.message },
    });
  }
});

// ---------------------------------------------------------------------------
// 4) DEPRECATED: create-customer via /privacy/customers
//    Not supported for your credit monitoring product. We keep this route
//    but force it to fail clearly so nothing calls the wrong business unit.
// ---------------------------------------------------------------------------
app.post("/consumerdirect/create-customer", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(400).json({
    error: "Not supported",
    details:
      "/v1/privacy/customers is not supported for this credit monitoring integration. Use hosted signup plus /v1/customers and Login-As instead.",
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
