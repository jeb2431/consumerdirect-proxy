import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 3000;
// use whichever you actually set in Render; keeping both for safety
const INTERNAL_SECRET =
  process.env.CD_PROXY_INTERNAL_SHARED_SECRET || process.env.INTERNAL_SHARED_SECRET;

const CD_BASE_URL = process.env.CD_BASE_URL || "https://papi.consumerdirect.io";
const CD_CLIENT_ID = process.env.CD_CLIENT_ID;
const CD_CLIENT_SECRET = process.env.CD_CLIENT_SECRET;

// ===== Helper: get OAuth2 access token =====
async function getAccessToken() {
  if (!CD_CLIENT_ID || !CD_CLIENT_SECRET) {
    throw new Error("CD_CLIENT_ID or CD_CLIENT_SECRET is not set");
  }

  const authResponse = await axios.post(
    "https://auth.consumerdirect.io/oauth2/token",
    // NOTE: scope value should match what CD gave you
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

// ===== Middleware: simple auth for proxy =====
app.use((req, res, next) => {
  if (!INTERNAL_SECRET) {
    return res.status(500).json({
      error: "Proxy misconfigured: INTERNAL_SECRET is not set",
    });
  }

  const token = req.headers["x-internal-secret"];
  if (!token || token !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

// ===== Health check =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", baseUrl: CD_BASE_URL });
});

// ===== GET /consumerdirect/get-customers =====
app.get("/consumerdirect/get-customers", async (req, res) => {
  try {
    const { pid } = req.query;
    if (!pid) {
      return res.status(400).json({ error: "pid is required" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers?pid=${encodeURIComponent(pid)}`;
    console.log("CD get-customers outbound request:", { url });

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

// ===== POST /consumerdirect/create-customer =====
// NOTE: this now calls /v1/customers (NOT /v1/privacy/customers)
app.post("/consumerdirect/create-customer", async (req, res) => {
  try {
    const payload = req.body; // should match ConsumerDirect's customer creation schema

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers`;
    console.log("CD create-customer outbound request:", { url, payload });

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

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

// ===== POST /consumerdirect/login-as =====
app.post("/consumerdirect/login-as", async (req, res) => {
  try {
    const { customerToken, agentId } = req.body;

    if (!customerToken) {
      return res.status(400).json({ error: "customerToken is required" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers/${encodeURIComponent(
      customerToken
    )}/otcs/login-as`;
    const body = {
      agentId: agentId || "Credit2Credit Support",
    };

    console.log("CD login-as outbound request:", { url, body });

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

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`ConsumerDirect proxy running on port ${PORT}`);
  console.log(`Using CD_BASE_URL: ${CD_BASE_URL}`);
});
