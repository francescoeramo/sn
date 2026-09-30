import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Generated tooling, not application code: `scripts/*.js` shims (regenerable, first-party
  // scripts use .mjs) and the installed Easy OpenCode plugin bundle.
  globalIgnores(['.next/**', 'artifacts/**', 'next-env.d.ts', 'scripts/*.js', '.opencode/**']),
]);
