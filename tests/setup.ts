import { mock } from 'bun:test';
import React from 'react';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// DOM for component tests. No database env required (local-first app).
GlobalRegistrator.register();

// next/image resolves loader URLs against a browser origin that happy-dom lacks, so render a plain img.
mock.module('next/image', () => ({
  default: ({ alt }: { alt?: string }) => React.createElement('img', { alt }),
}));
