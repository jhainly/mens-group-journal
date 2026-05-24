import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

const config = [
  {
    ignores: [".amplify/**", ".next/**", "node_modules/**", "amplify_outputs.json"]
  },
  ...compat.extends("next/core-web-vitals")
];

export default config;
