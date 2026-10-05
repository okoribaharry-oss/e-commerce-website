import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  process.env.VITE_SITE_MODE ||= environment.VITE_SITE_MODE || "api";

  return {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true
        }
      }
    }
  };
});
