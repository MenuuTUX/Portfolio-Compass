// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) on
// bun:test's expect() type. The runtime side is wired up per-file via
// expect.extend(matchers); this file only teaches TypeScript about it.
// Ref: https://bun.com/guides/test/testing-library

import { expect } from 'bun:test';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'bun:test' {
  interface Matchers<T>
    extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  interface AsymmetricMatchers
    extends TestingLibraryMatchers<typeof expect.stringContaining, unknown> {}
}
