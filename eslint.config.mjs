import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Layering contract (see docs/ARCHITECTURE.md). Dependencies point inward:
//   app -> features -> store -> core        components -> core/lib
// `core/` is framework-free: no React, no Next, no browser-only globals at import time.
const layer = (files, patterns, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: patterns.map((group) => ({ group, message })) }],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "public/**", "next-env.d.ts"]),
  layer(
    ["core/**/*.{ts,tsx}"],
    [
      ["react", "react-dom", "react/*", "next", "next/*", "zustand", "zustand/*"],
      ["@/store/*", "@/features/*", "@/components/*", "@/app/*", "@/lib/*"],
    ],
    "core/ is framework-free and may only import from core/ (see docs/ARCHITECTURE.md).",
  ),
  layer(
    ["store/**/*.{ts,tsx}"],
    [["@/features/*", "@/components/*", "@/app/*"]],
    "store/ may only depend on core/ and lib/.",
  ),
  layer(
    ["components/**/*.{ts,tsx}"],
    [["@/features/*", "@/app/*"]],
    "components/ is shared UI: it must not import from features/ or app/.",
  ),
  layer(
    ["features/**/*.{ts,tsx}"],
    [["@/app/*"]],
    "features/ must not import from app/.",
  ),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
