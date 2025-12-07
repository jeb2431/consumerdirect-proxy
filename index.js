import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// IMPORTANT: this reads the same secret we set earlier in Render
const INTERNAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

// ConsumerDirect config
const CD_BASE_URL = process.env.CD_BASE_URL || "https://api.consumerdirect.io";
const CD_CLIENT_ID = process.env.CD_CLIENT_ID;
const CD_CLIENT_SECRET = process.env.CD_CLIENT_SECRET;

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

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

