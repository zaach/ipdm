import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      events: "@zaach/rollup-plugin-node-polyfills/polyfills/events",
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "IPDM Client",
      fileName: "index",
    },
    target: "es2022",
  },
  plugins: [dts()],
});
