import tailwindcss from "@tailwindcss/postcss";
import stripLayers from "./postcss-strip-layers.mjs";

const config = {
  plugins: [
    tailwindcss({ optimize: { minify: true } }),
    stripLayers(),
  ],
};

export default config;
