/**
 * Retry with exponential backoff. The sleep function is
 * injectable so tests are instant and deterministic.
 */

export const DEFAULT_ATTEMPTS = 3;

export function backoffDelays(attempts = DEFAULT_ATTEMPTS, baseMs = 500): number[] {
  return Array.from({ length: Math.max(0, attempts - 1) }, (_, index) =>
    Math.round(baseMs * 4 ** index),
  );
}

export type RetryOptions = {
  attempts?: number;
  baseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const delays = backoffDelays(attempts, options.baseMs);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = delays[attempt];
      if (attempt < attempts - 1 && delay !== undefined) {
        options.onRetry?.(attempt + 1, error, delay);
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
