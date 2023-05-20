import rollupNodePolyFill from "@zaach/rollup-plugin-node-polyfills";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      events: "@zaach/rollup-plugin-node-polyfills/polyfills/events",
    },
  },
  build: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: { target: "es2022", supported: { bigint: true } },
  },
  server: {
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
    },
    open: true,
  },
  jsx: {
    factory: "h",
    fragment: "Fragment",
  },
  plugins: [preact()],
});
