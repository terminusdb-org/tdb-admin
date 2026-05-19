import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 4100,
    strictPort: true,
    proxy: {
      // Proxy TDB API paths to TerminusDB backend.
      // Used in docker-compose dev mode where VITE_TDB_URL="" (same-origin).
      // In standalone dev (npm run dev), set VITE_TDB_URL=http://localhost:6363 instead.
      "/api": {
        target: process.env.TDB_PROXY_TARGET ?? "http://localhost:6363",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    env: {
      VITE_TDB_URL: "http://localhost:6363",
      VITE_TDB_USER: "admin",
    },
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
});
