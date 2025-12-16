// index.js
// ConsumerDirect PAPI proxy on Render, using Fixie via HTTP(S)_PROXY env vars

import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// --------------------------------------
// Environment variables
// --------------------------------------
const PORT = process.env.PORT || 3000;
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET;

const CD_BASE_URL = process.env.CD_BASE_URL || "https://papi.consumerdirect.io"; // e.g. https://papi.consumerdirect.io
const CD_CLIENT_ID = process.env.CD_CLIENT_ID;       // your PAPI OAuth client_id
const CD_CLIENT_SECRET = process.env.CD_CLIENT_SECRET; // your PAPI OAuth client_secret

// Basic env check
if (!INTERNAL_SHARED_SECRET || !CD_BASE_URL || !CD_CLIENT_ID || !CD_CLIENT_SECRET) {
  console.error("Missing required environment variables for ConsumerDirect proxy:", {
    hasInternalSecret: !!INTERNAL_SHARED_SECRET,
    hasBaseUrl: !!CD_BASE_URL,
    hasClientId: !!CD_CLIENT_ID,
    hasClientSecret: !!CD_CLIENT_SECRET,
  });
  process.exit(1);
}

// --------------------------------------
// Helper: internal auth middleware
// --------------------------------------
function requireInternalAuth(req, res, next) {
  const token = req.headers["x-internal-secret"];
  if (!token || token !== INTERNAL_SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// --------------------------------------
// Helper: get OAuth access token from CD
// --------------------------------------
async function getAccessToken() {
  try {
    const body = "grant_type=client_credentials&scope=target-entity:e6c9113e-48b8-41ef-a87e-87a3c51a5e83";

    const authHeader =
      "Basic " + Buffer.from(`${CD_CLIENT_ID}:${CD_CLIENT_SECRET}`).toString("base64");

    const resp = await axios.post(
      "https://auth.consumerdirect.io/oauth2/token",
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
      }
    );

    return resp.data.access_token;
  } catch (err) {
    console.error(
      "Error getting ConsumerDirect access token:",
      err.response?.data || err.message
    );
    throw new Error("Failed to obtain ConsumerDirect access token");
  }
}

// --------------------------------------
// Health check (no auth required)
// --------------------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    baseUrl: CD_BASE_URL,
  });
});

// --------------------------------------
// 1) Get credit score for a customer
//    POST /consumerdirect/get-credit-score
//    Body: { customerToken: "..." }
// --------------------------------------
app.post("/consumerdirect/get-credit-score", requireInternalAuth, async (req, res) => {
  try {
    const { customerToken } = req.body || {};

    if (!customerToken) {
      return res.status(400).json({ error: "customerToken is required" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers/${encodeURIComponent(
      customerToken
    )}/credit-scores`;

    console.log("CD get-credit-score outbound request:", { url });

    const cdRes = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    res.status(cdRes.status).json(cdRes.data);
  } catch (err) {
    console.error(
      "ConsumerDirect get-credit-score error:",
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({
      error: "ConsumerDirect get-credit-score failed",
      details: err.response?.data || { message: err.message },
    });
  }
});

// --------------------------------------
// 2) Get customers list (PAPI /v1/customers)
//    POST /consumerdirect/get-customers
//    Body: { pid?: string, page?: number, pageSize?: number }
// --------------------------------------
app.post("/consumerdirect/get-customers", requireInternalAuth, async (req, res) => {
  try {
    const { pid, page, pageSize } = req.body || {};

    const accessToken = await getAccessToken();

    const params = {};
    if (pid) params.pid = pid;
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;

    const url = `${CD_BASE_URL}/v1/customers`;

    console.log("CD get-customers outbound request:", { url, params });

    const cdRes = await axios.get(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    });

    res.status(cdRes.status).json(cdRes.data);
  } catch (err) {
    console.error(
      "ConsumerDirect get-customers error:",
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({
      error: "ConsumerDirect get-customers failed",
      details: err.response?.data || { message: err.message },
    });
  }
});

// --------------------------------------
// 3) Agent Login-As (PAPI /v1/customers/{customerToken}/otcs/login-as)
//    POST /consumerdirect/login-as
//    Body: { customerToken: string, agentId: string }
// --------------------------------------
app.post("/consumerdirect/login-as", requireInternalAuth, async (req, res) => {
  try {
    const { customerToken, agentId } = req.body || {};

    if (!customerToken) {
      return res.status(400).json({ error: "customerToken is required" });
    }
    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers/${encodeURIComponent(
      customerToken
    )}/otcs/login-as`;

    const payload = { agentId };

    console.log("CD login-as outbound request:", { url, body: payload });

    const cdRes = await axios.post(url, payload, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Expected to return an OTC object: { code, expirationDateTime, type: "LOGIN_AS", ... }
    res.status(cdRes.status).json(cdRes.data);
  } catch (err) {
    console.error(
      "ConsumerDirect login-as error:",
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({
      error: "ConsumerDirect login-as failed",
      details: err.response?.data || { message: err.message },
    });
  }
});

// --------------------------------------
// Start server
// --------------------------------------
app.listen(PORT, () => {
  console.log(`ConsumerDirect proxy running on port ${PORT}`);
  console.log(`Using CD_BASE_URL: ${CD_BASE_URL}`);
});
