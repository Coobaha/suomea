const production = process.env.NODE_ENV === 'production'; // or some other env var like NODE_ENV
module.exports = {
  plugins: [],
  purge: {
    enabled: production, // disable purge in dev
    content: ['./public/**/*.html', './src/**/*.svelte'],

    options: {
      whitelistPatterns: [/svelte-/],
      defaultExtractor: (content) =>
        [...content.matchAll(/(?:class:)*([\w\d-/:%.]+)/gm)].map(
          ([_match, group, ..._rest]) => group,
        ),
    },
  },
};
