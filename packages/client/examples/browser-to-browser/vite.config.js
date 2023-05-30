export default {
  build: {
    target: "es2022",
    //rollupOptions: {
      //external: ["@ipdm/client"],
    //},
  },
  optimizeDeps: {
    esbuildOptions: { target: "es2022", supported: { bigint: true } },
  },
  server: {
    open: true,
  },
};

