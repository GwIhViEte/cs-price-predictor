const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const DEFAULT_CSQAQ_BASE_URL = 'https://api.csqaq.com/api/v1';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_CSQAQ_RATE_LIMIT_MS = 1000;

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadConfig(env = process.env) {
  const rootDir = path.resolve(__dirname, '..');

  return {
    port: toPositiveInteger(env.PORT, 3000),
    publicDir: path.join(rootDir, 'public'),
    csqaq: {
      baseURL: trimTrailingSlash(env.CSQAQ_API_BASE_URL || DEFAULT_CSQAQ_BASE_URL),
      apiToken: env.CSQAQ_API_TOKEN || '',
      rateLimitMs: toPositiveInteger(env.CSQAQ_RATE_LIMIT_MS, DEFAULT_CSQAQ_RATE_LIMIT_MS)
    },
    openai: {
      baseURL: trimTrailingSlash(env.OPENAI_API_BASE_URL || DEFAULT_OPENAI_BASE_URL),
      apiKey: env.OPENAI_API_KEY || '',
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
    }
  };
}

module.exports = {
  DEFAULT_CSQAQ_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  loadConfig
};
