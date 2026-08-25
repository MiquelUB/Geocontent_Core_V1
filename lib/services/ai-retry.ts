/**
 * PXX — Retry amb backoff exponencial per a crides a APIs d'IA (OpenRouter, etc.)
 *
 * Reintenta automàticament en errors transitoris:
 * - 429: Rate limit del proveïdor d'IA
 * - 500, 502, 503, 504: Errors de servidor/gateway
 *
 * Ús:
 *   const result = await withRetry(() => openai.chat.completions.create({ ... }));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const status = error?.status || error?.response?.status;
      const isRetryable = [429, 500, 502, 503, 504].includes(status);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Backoff exponencial amb jitter per evitar thundering herd
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(
        `[AI Retry] Attempt ${attempt + 1}/${maxRetries}, HTTP ${status}, waiting ${Math.round(delay)}ms before retry`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
