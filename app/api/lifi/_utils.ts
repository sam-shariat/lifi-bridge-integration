export const getApiBase = () => process.env.LI_FI_API_BASE || 'https://li.quest/v1';
export const getIntentsBase = () => process.env.LI_FI_INTENTS_BASE || 'https://intents.li.fi/v1';

// Use a simple record type; relying on internal Next.js headers types caused build issues.
export function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'accept': 'application/json' };
  const apiKey = process.env.LI_FI_API_KEY;
  if (apiKey) headers['x-lifi-api-key'] = String(apiKey);
  return headers;
}

export function forwardSearch(base: string, path: string, search: URLSearchParams) {
  const url = new URL(path, base);
  // Append all search params as-is
  search.forEach((v, k) => url.searchParams.append(k, v));
  return url.toString();
}
