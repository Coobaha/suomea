/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    public: { url: '/', static: true },
    src: { url: '/dist' },
  },
  routes: [
    { match: 'routes', src: '/iframe.html', dest: '/iframe.html' },
    { match: 'routes', src: '.*', dest: '/index.html' },
  ],
  plugins: [
    '@snowpack/plugin-svelte',
    '@snowpack/plugin-dotenv',
    '@snowpack/plugin-typescript',
    [
      '@snowpack/plugin-webpack',
      {
        manifest: true,
        extendConfig: (config) => {
          return config;
        },
      },
    ],
    [
      '@snowpack/plugin-babel',
      {
        transformOptions: {
          presets: [
            '@babel/preset-typescript',
            [
              '@babel/preset-env',
              {
                loose: true,
                modules: false,
                targets: {
                  esmodules: true,
                },
                bugfixes: true,
              },
            ],
          ],
        },
      },
    ],
    './myPlugin',
  ],
  packageOptions: {},
  devOptions: {
    /* ... */
    open: 'none',
    hmrPort: 80,
    hostname: '0.0.0.0',
  },
  buildOptions: {
    baseUrl: './',
    /* ... */
  },
  alias: {
    /* ... */
  },
};
