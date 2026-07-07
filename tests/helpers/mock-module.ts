import { afterAll, mock } from 'bun:test';

/**
 * Drop-in replacement for bun's mock.module that restores the real module
 * after the current test file finishes. Bun keeps module mocks alive across
 * test files in the same run, so an unrestored mock leaks into every file
 * that runs later (e.g. mocking '@/lib/monte-carlo' in a component test
 * breaks the real math tests in tests/unit/lib/monte-carlo.test.ts).
 */
export async function mockModule(
  specifier: string,
  factory: () => unknown,
): Promise<void> {
  const original = { ...(await import(specifier)) };
  mock.module(specifier, factory);
  afterAll(() => {
    mock.module(specifier, () => original);
  });
}
