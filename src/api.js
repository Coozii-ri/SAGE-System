export async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      const error = new Error(`The server returned an invalid response (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (!text) {
    const error = new Error(`The server returned an empty response (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
