// Quotas come from the endpoint, never from a guessed per-user allowance.
export interface KeylessQuota {
  limit: number | null;
  remaining: number | null;
  resetAt: number | null;
}
export const unknownQuota: KeylessQuota = {
  limit: null,
  remaining: null,
  resetAt: null,
};
let quota = unknownQuota;
const listeners = new Set<() => void>();
export const getKeylessQuota = () => quota;
export function subscribeKeylessQuota(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function keylessRemaining(now = Date.now()): number | null {
  if (quota.resetAt !== null && now >= quota.resetAt) return null;
  return quota.remaining;
}
export function updateKeylessQuota(response: Response) {
  const number = (name: string) => {
    const raw = response.headers.get(name);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  };
  const limit = number("x-ratelimit-limit");
  const remaining = number("x-ratelimit-remaining");
  const reset = number("x-ratelimit-reset");
  const retry = response.headers.get("retry-after");
  let resetAt = reset === null ? null : reset * 1000;
  if (response.status === 429 && retry) {
    const seconds = Number(retry);
    const retryAt =
      Number.isFinite(seconds) && seconds >= 0
        ? Date.now() + seconds * 1000
        : Date.parse(retry);
    if (Number.isFinite(retryAt)) resetAt = Math.max(resetAt ?? 0, retryAt);
  }
  quota = {
    limit,
    remaining: response.status === 429 ? 0 : remaining,
    resetAt,
  };
  listeners.forEach((listener) => listener());
}
