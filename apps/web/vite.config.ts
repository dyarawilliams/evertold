import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_URL = "http://127.0.0.1:3001";

export function apiProxyTarget(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    return DEFAULT_API_URL;
  }
  const withoutSlash = trimmed.replace(/\/+$/, "");
  const withoutApiSuffix = withoutSlash.replace(/\/api$/, "");
  return withoutApiSuffix === "" ? DEFAULT_API_URL : withoutApiSuffix;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const apiUrl = apiProxyTarget(env.VITE_API_URL);

  return {
    envDir: "../..",
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  };
});
