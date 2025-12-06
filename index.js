import express from "express";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const app = express();
app.use(express.json());

const FIXIE_URL = process.env.FIXIE_URL;
const CD_BASE_URL = process.env.CD_BASE_URL;
const CD_PARTNER_ID = process.env.CD_PARTNER_ID;
const CD_API_KEY = process.env.CD_API_KEY;
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET;
const PORT = process.env.PORT || 3000;

if (!FIXIE_URL || !CD_BASE_URL || !INTERNAL_SHARED_SECRET) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const agent = new HttpsProxyAgent(FIXIE_URL);

// Auth middleware
app.use((req, res, next) => {
  const token = req.headers["x-internal-secret"];
  if (!token || token !== INTERNAL_SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", proxy: "fixie" });
});

// Get credit score
app.post("/consumerdirect/get-credit-score", async (req, res) => {
  try {
    const payload = req.body;

    const cdRes = await axios.post(
      `${CD_BASE_URL}/getcreditscore`,
      payload,
      {
        httpsAgent: agent,
        headers: {
          "Content-Type": "application/json",
          "X-Partner-Id": CD_PARTNER_ID,
          "X-Api-Key": CD_API_KEY,
        },
      }
    );

    res.status(cdRes.status).json(cdRes.data);
  } catch (err) {
    console.error("ConsumerDirect error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: "ConsumerDirect request failed",
      details: err.response?.data || err.message
    });
  }
});

// Get customer details
app.post("/consumerdirect/get-customer", async (req, res) => {
  try {
    const { customerToken } = req.body;
    
    const cdRes = await axios.get(
      `${CD_BASE_URL}/customers/${customerToken}`,
      {
        httpsAgent: agent,
        headers: {
          "Content-Type": "application/json",
          "X-Partner-Id": CD_PARTNER_ID,
          "X-Api-Key": CD_API_KEY,
        },
      }
    );

    res.status(cdRes.status).json(cdRes.data);
  } catch (err) {
    console.error("ConsumerDirect error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: "ConsumerDirect request failed",
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`ConsumerDirect proxy running on port ${PORT}`);
  console.log(`Using Fixie proxy: ${FIXIE_URL}`);
});
