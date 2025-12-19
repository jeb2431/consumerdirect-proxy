/**
 * consumerdirect-proxy
 * index.js
 * FULL REPLACEMENT FILE (ESM SAFE)
 */

// ------------------------------
// ENV VISIBILITY (SAFE)
// ------------------------------
console.log("ENV CHECK (names only):", {
  CD_CLIENT_ID: !!process.env.CD_CLIENT_ID,
  CD_CLIENT_SECRET: !!process.env.CD_CLIENT_SECRET,
  CONSUMER_DIRECT_CLIENT_ID: !!process.env.CONSUMER_DIRECT_CLIENT_ID,
  CONSUMER_DIRECT_CLIENT_SECRET: !!process.env.CONSUMER_DIRECT_CLIENT_SECRET,
  CONSUMER_DIRECT_API_KEY: !!process.env.CONSUMER_DIRECT_API_KEY,
  CONSUMER_DIRECT_API_SECRET: !!process.env.CONSUMER_DIRECT_API_SECRET,
  CD_BASE_URL: !!process.env.CD_BASE_URL,
  CONSUMER_DIRECT_BASE_URL: !!process.env.CONSUMER_DIRECT_BASE_URL,
  INTERNAL_SHARED_SECRET: !!process.env.INTERNAL_SHARED_SECRET,
  CD_PROXY_INTERNAL_SHARED_SECRET: !!process.env.CD_PROXY_INTERNAL_SHARED_SECRET,
});

// ------------------------------
// RESOLVE VALUES (FIRST ONE WINS)
// ------------------------------
const clientId =
  process.env.CD_CLIENT_ID ||
  process.env.CONSUMER_DIRECT_CLIENT_ID ||
  process.env.CONSUMER_DIRECT_API_KEY;

const clientSecret =
  process.env.CD_CLIENT_SECRET ||
  process.env.CONSUMER_DIRECT_CLIENT_SECRET ||
  process.env.CONSUMER_DIRECT_API_SECRET;

const baseUrl =
  process.env.CD_BASE_URL ||
  process.env.CONSUMER_DIRECT_BASE_URL ||
  "https://papi.consumerdirect.io";

const tokenUrl =
  process.env.CONSUMER_DIRECT_TOKEN_URL ||
  "https://auth.consumerdirect.io/oauth2/token";

const targetEntity =
  process.env.CONSUMER_DIRECT_TARGET_ENTITY ||
  null;

const internalSecret =
  process.env.INTERNAL_SHARED_SECRET ||
  process.env.CD_PROXY_INTERNAL_SHARED_SECRET;

// ------------------------------
// HARD FAIL IF MISSING
// ------------------------------
const hasClientId = !!clientId;
const hasClientSecret = !!clientSecret;
const hasBaseUrl = !!baseUrl;
const hasInternalSecret = !!internalSecret;

if (!hasClientId || !hasClientSecret || !hasBaseUrl || !hasInternalSecret) {
  console.error("❌ Missing required environment variables:", {
    hasInternalSecret,
    hasBaseUrl,
    hasClientId,
    hasClientSecret,
  });
  process.exit(1);
}

// ------------------------------
// START PLACEHOLDER SERVER (ESM)
// ------------------------------
import http from "http";

const PORT = process.env.PORT || 10000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        hasClientId,
        hasClientSecret,
        hasBaseUrl,
        hasInternalSecret,
      })
    );
  })
  .listen(PORT, () => {
    console.log(`✅ ConsumerDirect proxy running on port ${PORT}`);
  });

// ------------------------------
// EXPORT (FOR FUTURE USE)
// ------------------------------
export {
  clientId,
  clientSecret,
  baseUrl,
  tokenUrl,
  targetEntity,
  internalSecret,
};
