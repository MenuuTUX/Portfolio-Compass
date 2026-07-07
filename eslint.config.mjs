import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'out/**', 'lib/generated/**']),
  ...nextCoreWebVitals,
  {
    // Test mocks intentionally render bare <img> in place of next/image
    files: ['tests/**'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
]);
