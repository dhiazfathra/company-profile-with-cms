import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Section components render content-driven `src` values (including the
  // placeholder SVGs from TOKEN-GAPS.md) whose intrinsic dimensions are not
  // content, so next/image's required width/height cannot be supplied.
  {
    files: ["components/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e-throwaway/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "e2e-results/**",
  ]),
]);

export default eslintConfig;
