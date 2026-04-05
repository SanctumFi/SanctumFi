import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    },
  },
});
