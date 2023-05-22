import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import ImportMetaEnvPlugin from "@import-meta-env/unplugin";

export default defineConfig({
  build: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: { target: "es2022", supported: { bigint: true } },
  },
  server: {
    open: true,
  },
  plugins: [
    preact(),
    ImportMetaEnvPlugin.vite({
      example: ".env.example",
      env: ".env",
      transformMode: "compile-time",
    }),
  ],
});
