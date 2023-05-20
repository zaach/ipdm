/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./index.html", "./src/**/*.tsx"],
  theme: {
    extend: {
      screens: {
        pwa: { raw: "(display-mode: standalone)" },
      },
    },
  },
  plugins: [
    require("daisyui"),
    plugin(({ addVariant }) => {
      addVariant(
        "peer-change-other",
        `:merge(.peer)[data-author="self"] + &[data-author="other"]`
      );
      addVariant(
        "peer-change-self",
        `:merge(.peer)[data-author="other"] + &[data-author="self"]`
      );
    }),
  ],
  daisyui: {
    themes: ["light", "dark"],
    darkTheme: "dark",
  },
};
