import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  process.env.VITE_SITE_MODE ||= environment.VITE_SITE_MODE || "api";
  process.env.VITE_API_BASE_URL ||= environment.VITE_API_BASE_URL || "";

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
