import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist/**", "**/dist/**", "coverage/**", ".venv/**", "data/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // `declare global { namespace Express }` is the Express locals augmentation.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      // Existing parsers assign a fallback, then replace it. That is intentional.
      "no-useless-assignment": "off",
    },
  },
]);
