/**
 * consumerdirect-proxy
 * index.js
 * REAL PROXY (ESM):
 * - requires x-internal-secret
 * - exchanges client credentials for access_token
 * - forwards requests to PAPI (production)
 */

import http from "http";
import { URL } from "url";

// ------------------------------
// ENV RESOLUTION
// ------------------------------
const clientId =
  process.env.CONSUMER_DIRECT_CLIENT_ID ||
  process.env.CONSUMER_DIRECT_API_KEY ||
  "";

const clientSecret =
  process.env.CONSUMER_DIRECT_CLIENT_SECRET ||
  process.env.CONSUMER_DIRECT_API_SECRET ||
  "";

const papiBaseUrl = (process.env.CONSUMER_DIRECT_BASE_URL || "https://papi.consumerdirect.io").replace(/\/+$/, "");
const tokenUrl = process.env.CONSUMER_DIRECT_TOKEN_URL || "https://auth.consumerdirect.io/oauth2/token";
const targetEntity = process.env.CONSUMER_DIRECT_TARGET_ENTITY || "";
const internalSecret = process.env.INTERNAL_SHARED_SECRET || "";

console.log("ENV CHECK (names only):", {
  CONSUMER_DIRECT_CLIENT_ID: !!process.env.CONSUMER_DIRECT_CLIENT_ID,
  CONSUMER_DIRECT_CLIENT_SECRET: !!process.env.CONSUMER_DIRECT_CLIENT_SECRET,
  CONSUMER_DIRECT_API_KEY: !!process.env.CONSUMER_DIRECT_API_KEY,
  CONSUMER_DIRECT_API_SECRET: !!process.env.CONSUMER_DIRECT_API_SECRET,
  CONSUMER_DIRECT_BASE_URL: !!process.env.CONSUMER_DIRECT_BASE_URL,
  CONSUMER_DIRECT_TOKEN_URL: !!process.env.CONSUMER_DIRECT_TOKEN_URL,
  CONSUMER_DIRECT_TARGET_ENTITY: !!process.env.CONSUMER_DIRECT_TARGET_ENTITY,
  INTERNAL_SHARED_SECRET: !!process.env.INTERNAL_SHARED_SECRET,
});

if (!clientId || !clientSecret || !papiBaseUrl || !tokenUrl || !internalSecret) {
  console.error("❌ Missing required environment variables:", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasPapiBaseUrl: !!papiBaseUrl,
    hasTokenUrl: !!tokenUrl,
    hasInternalSecret: !!internalSecret,
    hasTargetEntity: !!targetEntity,
  });
  process.exit(1);
}

// ------------------------------
// Helpers
// ------------------------------
function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ------------------------------
// Token cache
// ------------------------------
let cachedToken = null;
let cachedTokenExpMs = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpMs - 5000) return cachedToken;

  const scope = targetEntity ? `target-entity:${targetEntity}` : "";
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    ...(scope ? { scope } : {}),
  }).toString();

  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: form,
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!r.ok || !json?.access_token) {
    throw new Error(`token_exchange_failed HTTP ${r.status}: ${text}`);
  }

  cachedToken = json.access_token;
  const expiresIn = Number(json.expires_in || 300);
  cachedTokenExpMs = Date.now() + expiresIn * 1000;
  return cachedToken;
}

// ------------------------------
// Main handler
// ------------------------------
async function handle(req, res) {
  // Health (no secret required)
  if (req.url === "/" || req.url === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  // Require internal secret for everything else
  const provided = req.headers["x-internal-secret"];
  if (!provided || provided !== internalSecret) {
    return sendJson(res, 401, { error: "unauthorized" });
  }

  // Forward any path to PAPI
  const incoming = new URL(req.url, "http://localhost");
  const target = `${papiBaseUrl}${incoming.pathname}${incoming.search}`;

  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    return sendJson(res, 502, { error: "token_exchange_failed", message: String(e.message || e) });
  }

  const method = req.method || "GET";
  const body = await readBody(req);

  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  delete headers["x-internal-secret"];

  headers.authorization = `Bearer ${token}`;

  const papiResp = await fetch(target, {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? undefined : body,
  });

  const outBuf = Buffer.from(await papiResp.arrayBuffer());
  const outCt = papiResp.headers.get("content-type") || "application/json";
  res.writeHead(papiResp.status, { "Content-Type": outCt });
  res.end(outBuf);
}

// ------------------------------
// Server
// ------------------------------
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("❌ Proxy error:", err);
    sendJson(res, 500, { error: "proxy_error", message: String(err?.message || err) });
  });
}).listen(PORT, () => {
  console.log(`✅ ConsumerDirect proxy running on port ${PORT}`);
  console.log(`➡️ PAPI Base: ${papiBaseUrl}`);
  console.log(`➡️ Token URL: ${tokenUrl}`);
});
