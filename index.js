import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Internal shared secret used to authorize calls from your backend
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

// Health check (requires internal secret)
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

// Get credit score
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

    // 1) Get JWT token
    const accessToken = await getAccessToken();

    // 2) Call ConsumerDirect API with JWT
    const response = await axios.get(
      `${CD_BASE_URL}/v1/customers/${customerToken}/credit-scores`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect API Error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "ConsumerDirect request failed",
      details: error.response?.data || { message: error.message },
    });
  }
});

// Create customer
app.post("/consumerdirect/create-customer", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = req.body; // should match ConsumerDirect's customer creation schema

    // NEW: log exactly what we send to ConsumerDirect
    console.log("CD create-customer outbound request:", {
      url: `${CD_BASE_URL}/v1/privacy/customers`,
      payload,
    });

    // 1) Get JWT token
    const accessToken = await getAccessToken();

    // 2) Call ConsumerDirect create-customer endpoint
    const response = await axios.post(
      `${CD_BASE_URL}/v1/privacy/customers`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect create-customer error:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "ConsumerDirect create-customer failed",
      details: error.response?.data || { message: error.message },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
