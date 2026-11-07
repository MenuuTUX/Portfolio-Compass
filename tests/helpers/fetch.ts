type FetchFake = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Replaces global fetch for the rest of the test. tests/setup.ts restores the real one after every test. */
export function withFetch(fake: FetchFake): void {
  globalThis.fetch = fake as unknown as typeof fetch;
}
