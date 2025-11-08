import type { HeadersInit } from 'next/dist/server/web/spec-extension/adapters/headers';

export const getApiBase = () => process.env.LI_FI_API_BASE || 'https://li.quest/v1';
export const getIntentsBase = () => process.env.LI_FI_INTENTS_BASE || 'https://intents.li.fi/v1';

export function buildHeaders(): HeadersInit {
  const headers: HeadersInit = { 'accept': 'application/json' };
  const apiKey = process.env.LI_FI_API_KEY;
  if (apiKey) headers['x-lifi-api-key'] = apiKey as string;
  return headers;
}

export function forwardSearch(base: string, path: string, search: URLSearchParams) {
  const url = new URL(path, base);
  // Append all search params as-is
  search.forEach((v, k) => url.searchParams.append(k, v));
  return url.toString();
}
