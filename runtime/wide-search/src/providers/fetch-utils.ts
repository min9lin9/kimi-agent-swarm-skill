export interface FetchWithRetryOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, retries = 2, retryDelayMs = 500, ...fetchOptions } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retries) {
        break;
      }

      const backoff = retryDelayMs * 2 ** attempt;
      await delay(backoff);
    }
  }

  const reason =
    lastError?.name === 'AbortError'
      ? `timed out after ${timeoutMs}ms`
      : (lastError?.message ?? 'unknown error');

  throw new Error(`Request to ${url} failed after ${retries + 1} attempt(s): ${reason}`);
}
