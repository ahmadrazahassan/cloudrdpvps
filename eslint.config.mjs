import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Tests read ad-hoc SQL result rows, which have no static type.
    files: ["supabase/tests/**/*.ts", "src/**/*.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-qa/**", // a second build kept beside the real one for previews (QA_DIST_DIR)
    ".next-brand/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the migrations by scripts/gen-types.ts
    "src/types/database.ts",
  ]),
]);

export default eslintConfig;
