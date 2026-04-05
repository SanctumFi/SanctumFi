import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Expose PLAID_* env vars (alongside the default VITE_* ones) to the browser
  envPrefix: ["VITE_", "PLAID_"],
  server: {
    proxy: {
      "/tee-proxy": {
        target: "http://localhost:6676",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tee-proxy/, ""),
      },
      "/tee-internal": {
        target: "http://localhost:6675",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tee-internal/, ""),
      },
      // Proxy Plaid sandbox calls to avoid CORS
      "/plaid-sandbox": {
        target: "https://sandbox.plaid.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/plaid-sandbox/, ""),
      },
    },
  },
});
