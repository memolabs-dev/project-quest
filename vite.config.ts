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
  // The 3D scene is loaded lazily: pre-bundle its libraries so the first visit does not re-optimize mid-load.
  optimizeDeps: {
    include: [
      "three", "@react-three/fiber", "@react-three/drei", "@react-three/rapier", "@react-three/postprocessing",
      "postprocessing", "ecctrl", "zustand", "i18next", "react-i18next", "i18next-browser-languagedetector",
    ],
  },
});
