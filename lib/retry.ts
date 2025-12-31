
export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    baseDelay?: number;
    maxDelay?: number;
    fallbackValue?: T;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelay = 2000,
    maxDelay = 15000,
    fallbackValue
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      const isRateLimit = error.message?.includes('429') ||
                          error.status === 429 ||
                          error.message?.includes('Too Many Requests') ||
                          error.message?.includes('Failed to get crumb');

      if (attempt > retries) {
        if (fallbackValue !== undefined) {
             console.warn(`[Retry] Function failed after ${retries} retries, returning fallback. Error: ${error.message}`);
             return fallbackValue;
        }
        throw error;
      }

      let delay = baseDelay * Math.pow(2, attempt - 1) + (Math.random() * 1000);

      if (isRateLimit) {
         delay = Math.min(delay * 2, maxDelay); // Aggressive backoff for rate limits
         console.warn(`[Retry] Yahoo Rate Limit/Crumb error (Attempt ${attempt}/${retries}). Waiting ${Math.round(delay)}ms...`);
      } else {
         delay = Math.min(delay, 10000); // Cap standard error delay
         console.warn(`[Retry] Error: ${error.message} (Attempt ${attempt}/${retries}). Waiting ${Math.round(delay)}ms...`);
      }

      await sleep(delay);
    }
  }
}
