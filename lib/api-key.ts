export const API_KEY_SESSION_STORAGE = "interfaze-people-search-api-key";

export function normalizeApiKey(value: string): string | null {
  const key = value.trim();
  return /^[\x21-\x7e]{1,4096}$/.test(key) ? key : null;
}
