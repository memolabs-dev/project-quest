import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Hono API (src/server/dev.ts) runs inside the Vite dev server; only /api/* reaches it.
export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: "src/server/dev.ts",
      exclude: [/^(?!\/api\/).*/],
    }),
  ],
});
