/**
 * AI provider switcher for Bedaya.
 * Set AI_PROVIDER=ollama to use a local model; default is Claude.
 * Bedaya only needs chat() — everything else is intentionally absent.
 */
const AI_PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();

let provider;
if (AI_PROVIDER === 'ollama') {
  provider = require('./ollama');
  console.log(`[AI] Using Ollama (model: ${provider.OLLAMA_MODEL})`);
} else {
  provider = require('./claude');
  console.log('[AI] Using Claude API');
}

module.exports = {
  chat: provider.chat,
  getProvider: () => AI_PROVIDER,
};
