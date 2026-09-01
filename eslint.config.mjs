import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Material do curso e design systems de referência: código de terceiros,
    // boa parte minificada. Sem isto o lint varre bundles alheios e reporta
    // milhares de problemas que não são nossos e que não vamos corrigir.
    "_curso/**",
    "docs/design-systems/**",
  ]),
]);

export default eslintConfig;
