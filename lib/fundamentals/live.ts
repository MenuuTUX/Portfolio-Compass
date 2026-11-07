import { createSecClient } from "./sec-client";
import { edgarLiveSource, withFallback } from "./source";

/** Thrown when SEC_USER_AGENT is not set; routes answer 503 with its message. */
export class SecNotConfiguredError extends Error {
  constructor() {
    super("Company filings are not configured on this server (SEC_USER_AGENT is not set).");
  }
}

let source: ReturnType<typeof withFallback> | null = null;

/** One shared SEC source per server process, so the rate limit and caches are shared. */
export function getFilingsSource() {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) throw new SecNotConfiguredError();
  source ??= withFallback(edgarLiveSource(createSecClient({ userAgent })));
  return source;
}
