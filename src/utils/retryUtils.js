/**
 * Generic async retry helper with exponential backoff and HTTP-aware
 * handling of `429 Too Many Requests` / `Retry-After` plus a fast-path for
 * non-retryable client errors.
 */

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const parseRetryAfter = (error) => {
  // OpenAI SDK exposes the underlying Response on `error.response`.
  const headers =
    error?.response?.headers ?? error?.headers ?? null;
  if (!headers) return null;

  const get = (key) => {
    if (typeof headers.get === 'function') return headers.get(key);
    return headers[key] ?? headers[key.toLowerCase()] ?? null;
  };

  const raw = get('retry-after') || get('Retry-After');
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
};

const isRetryable = (error) => {
  if (!error) return false;
  const status = error.status ?? error.statusCode ?? error.response?.status;
  if (status && !RETRYABLE_STATUS.has(status)) {
    // 4xx client errors (auth, validation) should fail fast.
    return false;
  }
  return true;
};

/**
 * Executes an async function with retries.
 *
 * @param {Function} fn The function to execute. Receives the current attempt
 *   index as its only argument.
 * @param {Object} [options]
 * @param {number} [options.maxRetries=3] Maximum retry attempts.
 * @param {number} [options.baseDelay=500] Base backoff in ms.
 * @param {number} [options.maxDelay=8000] Backoff ceiling in ms.
 * @param {Function} [options.retryOnResult] Predicate `(result, attempt) => boolean`.
 * @param {Function} [options.onRetry] Notification callback.
 * @param {Function} [options.onError] Logging callback for errors.
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 500;
  const maxDelay = options.maxDelay ?? 8000;
  const retryOnResult = options.retryOnResult || (() => false);
  const onRetry = options.onRetry || (() => {});
  const onError = options.onError || console.warn;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const backoff = (attempt) => Math.min(2 ** attempt * baseDelay, maxDelay);

  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      const result = await fn(attempt);

      const shouldRetry = await retryOnResult(result, attempt);
      if (shouldRetry) {
        if (attempt >= maxRetries) {
          return { ...result, retriesExhausted: true, retries: attempt };
        }
        attempt++;
        const delay = backoff(attempt);
        onRetry({
          retryCount: attempt,
          maxRetries,
          delay,
          result,
          type: 'result-based',
        });
        await sleep(delay);
        continue;
      }

      return { ...result, retries: attempt };
    } catch (error) {
      lastError = error;

      // Fail fast on non-retryable errors (e.g. 401/403/404).
      if (!isRetryable(error)) {
        onError(`Non-retryable error: ${error.message}`);
        break;
      }

      attempt++;
      if (attempt > maxRetries) break;

      // Honor `Retry-After` from rate-limit responses; otherwise back off.
      const retryAfterMs = parseRetryAfter(error);
      const delay = retryAfterMs != null
        ? Math.min(Math.max(retryAfterMs, baseDelay), maxDelay * 4)
        : backoff(attempt);

      onError(
        `Request failed (attempt ${attempt}/${maxRetries}): ${error.message}` +
          (retryAfterMs != null ? ` — honoring Retry-After ${Math.round(retryAfterMs)}ms` : '')
      );
      onRetry({
        retryCount: attempt,
        maxRetries,
        delay,
        error,
        type: retryAfterMs != null ? 'rate-limited' : 'error',
      });
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed after multiple retry attempts',
    details: lastError?.response?.data || lastError,
    retries: Math.max(0, attempt - 1),
  };
}
