import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Backend for /api (REST + WebSocket). Override with VITE_API_TARGET=http://host:port
  const target = loadEnv(mode, process.cwd(), "").VITE_API_TARGET || "http://localhost:8000"
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      proxy: { "/api": { target, changeOrigin: true, ws: true } },
    },
  }
})
