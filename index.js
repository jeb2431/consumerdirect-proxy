// ==============================
// ConsumerDirect ENV RESOLUTION
// ==============================

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
  process.env.CONSUMER_DIRECT_BASE_URL;

const tokenUrl =
  process.env.CONSUMER_DIRECT_TOKEN_URL ||
  'https://auth.consumerdirect.io/oauth2/token';

const targetEntity =
  process.env.CONSUMER_DIRECT_TARGET_ENTITY;

const internalSecret =
  process.env.INTERNAL_SHARED_SECRET ||
  process.env.CD_PROXY_INTERNAL_SHARED_SECRET;

// ==============================
// HARD STOP IF REQUIRED VARS MISSING
// ==============================

const hasClientId = !!clientId;
const hasClientSecret = !!clientSecret;
const hasBaseUrl = !!baseUrl;
const hasInternalSecret = !!internalSecret;

if (!hasClientId || !hasClientSecret || !hasBaseUrl || !hasInternalSecret) {
  console.error('Missing required environment variables for ConsumerDirect proxy:', {
    hasInternalSecret,
    hasBaseUrl,
    hasClientId,
    hasClientSecret,
  });
  process.exit(1);
}

// ==============================
// EXPORT / USE VALUES BELOW
// ==============================

module.exports = {
  clientId,
  clientSecret,
  baseUrl,
  tokenUrl,
  targetEntity,
  internalSecret,
};
