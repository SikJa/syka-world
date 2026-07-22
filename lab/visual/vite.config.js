import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: {
      "/bridge": {
        target: "http://127.0.0.1:8765",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/bridge/, ""),
      },
    },
  },
  preview: { host: "127.0.0.1" },
});
