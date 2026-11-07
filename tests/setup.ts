import { afterEach, mock } from 'bun:test';
import React from 'react';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// DOM for component tests. No database env required (local-first app).
GlobalRegistrator.register();

// next/image resolves loader URLs against a browser origin that happy-dom lacks, so render a plain img.
mock.module('next/image', () => ({
  default: ({ alt }: { alt?: string }) => React.createElement('img', { alt }),
}));

// Tests replace fetch through tests/helpers/fetch.ts; put the real one back after each test.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
