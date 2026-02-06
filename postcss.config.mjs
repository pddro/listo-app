const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Use lightningcss for better browser compatibility
      optimize: { minify: true },
    },
  },
};

export default config;
