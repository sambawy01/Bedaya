// Bedaya API helper — unwraps { success, data } and throws on failure.
// In dev, leave VITE_API_BASE unset; Vite's proxy routes /api to the local
// Express server. In prod, set VITE_API_BASE to the absolute backend URL
// (e.g. https://bedaya-server.up.railway.app) at build time.
const API_BASE = `${import.meta.env.VITE_API_BASE || ''}/api/bedaya`;

export async function api(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'حدث خطأ');
  return data.data;
}
