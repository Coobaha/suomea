const production = process.env.NODE_ENV === "production"; // or some other env var like NODE_ENV
module.exports = {
  plugins: [],
  theme: {
    extend: {},
  },
  content: ["./src/**/*.{html,js,svelte,ts}"],
  variants: {
    extend: {},
  },
  darkMode: 'media',
};
