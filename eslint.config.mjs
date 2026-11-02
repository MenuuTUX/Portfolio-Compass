import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'out/**', '.claude/**', 'graphify-out/**']),
  ...nextCoreWebVitals,
  {
    // React Compiler advisories from eslint-plugin-react-hooks 7. They flag working
    // patterns (reset state in an effect, read a ref for an animation) and are tracked
    // as warnings until each component is reworked.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Test mocks intentionally render bare <img> in place of next/image
    files: ['tests/**'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
]);
