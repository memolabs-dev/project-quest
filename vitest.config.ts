/// <reference types="vitest/config" />
import { configDefaults, defineConfig } from "vitest/config";

// Unit tests only; e2e/ belongs to Playwright (npm run test:e2e).
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "e2e/**"] } });
