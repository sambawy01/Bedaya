const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function ollamaRequest(endpoint, payload) {
  const response = await fetch(`${OLLAMA_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${error}`);
  }
  return response.json();
}

async function chat(messages, systemPrompt) {
  const response = await ollamaRequest('/api/chat', {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
    ],
    stream: false,
    options: { temperature: 0.7, top_p: 0.9 },
  });
  return response.message?.content || '';
}

module.exports = { chat, OLLAMA_MODEL };
