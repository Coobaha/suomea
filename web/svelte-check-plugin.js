const execa = require('execa');
const npmRunPath = require('npm-run-path');
const cwd = process.cwd();

function svelteCheckPlugin(_, { args } = {}) {
  return {
    name: 'Svelte check',
    async run({ isDev, log }) {
      const workerPromise = execa.command(
        `svelte-check ${isDev ? '--watch' : ''} ${args ? args : ''}`,
        {
          env: { ...npmRunPath.env(), FORCE_COLOR: 'true' },
          extendEnv: true,
          windowsHide: false,
          cwd,
        },
      );
      const { stdout, stderr } = workerPromise;
      function dataListener(chunk) {
        log('WORKER_RESET', {});

        const s = chunk.toString();
        if (s.includes('\u001bc') || s.includes('\x1Bc')) {
          // clear
        }

        let stdOutput = s
          .replace('Getting Svelte diagnostics...', '')
          .replace(/^Loading svelte-check.+$/gim, '')
          .replace('====================================', '');

        // In --watch mode, handle the "clear" character
        setTimeout(
          () =>
            stdOutput.trim() &&
            log('WORKER_MSG', { level: 'log', msg: stdOutput }),
          10,
        );
      }
      stdout && stdout.on('data', dataListener);
      stderr && stderr.on('data', dataListener);
      return workerPromise;
    },
  };
}

module.exports = svelteCheckPlugin;
