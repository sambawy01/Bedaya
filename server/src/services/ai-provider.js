/**
 * Vercel AI SDK based provider for Bedaya.
 * Switch by AI_PROVIDER env: 'claude' (default) | 'ollama'.
 *
 * Exposes:
 *   chat(messages, system)            — string in / string out (compat).
 *   structured(schema, { system, prompt })
 *                                     — Zod schema in / typed object out.
 *   model                             — the LanguageModel for direct SDK use.
 *   getProvider()                     — 'claude' | 'ollama' for boot log.
 */
const { generateText, generateObject } = require('ai');
const { createAnthropic } = require('@ai-sdk/anthropic');
const { createOllama } = require('ollama-ai-provider-v2');

const AI_PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();

let model;
let providerLabel;

if (AI_PROVIDER === 'ollama') {
  const baseURL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '') + '/api';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';
  // OLLAMA_API_KEY is required for Ollama Cloud (https://ollama.com), unused
  // for local self-hosted Ollama. When set, sent as a Bearer header.
  const headers = process.env.OLLAMA_API_KEY
    ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
    : undefined;
  const ollama = createOllama({ baseURL, headers });
  model = ollama(ollamaModel);
  providerLabel = `Ollama (model: ${ollamaModel}${headers ? ', cloud' : ', local'})`;
} else {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  model = anthropic('claude-haiku-4-5-20251001');
  providerLabel = 'Claude API';
}

console.log(`[AI] Using ${providerLabel}`);

async function chat(messages, system) {
  const { text } = await generateText({
    model,
    system,
    messages,
    maxOutputTokens: 1024,
  });
  return text;
}

async function structured(schema, { system, prompt }) {
  const { object } = await generateObject({
    model,
    schema,
    system,
    prompt,
    maxOutputTokens: 1024,
  });
  return object;
}

module.exports = {
  chat,
  structured,
  model,
  getProvider: () => AI_PROVIDER,
};
