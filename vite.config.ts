import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Tell Nitro to build specifically for Vercel's serverless runtime
  nitro: {
    preset: "vercel",
  },
});