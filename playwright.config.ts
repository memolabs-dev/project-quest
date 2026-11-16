import { defineConfig } from "@playwright/test";

// Runs against the installed Google Chrome (no browser download). Demo mode: nothing reaches GitHub.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:5199", channel: "chrome", viewport: { width: 1280, height: 800 } },
  // The load-time test runs alone, after the others: parallel WebGL pages share one GPU and slow each other down.
  projects: [
    { name: "main", testIgnore: /load\.spec\.ts/ },
    { name: "load", testMatch: /load\.spec\.ts/, dependencies: ["main"] },
  ],
  webServer: [
    { command: "QUEST_MODE=demo npx vite --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: false, timeout: 60_000 },
    { command: "QUEST_MODE=live GITHUB_TOKEN= QUEST_GH_BIN=/nonexistent/gh npx vite --port 5198 --strictPort", url: "http://localhost:5198", reuseExistingServer: false, timeout: 60_000 },
  ],
});
