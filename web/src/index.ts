import type { ViewContext } from './types';
import { termsHistory, updateSettings } from './ctx';
import App from './App.svelte';

const app = new App({
  target: document.body,
});

// import(
//   // @ts-ignore
//   'https://markknol.github.io/console-log-viewer/console-log-viewer.js?align=top'
// ).catch(alert);

window.addEventListener(
  'message',
  (event) => {
    if (event.data.type === 'update') {
      const setup = event.data.data;
      function stripHTML(html: string = ''): string {
        let doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent ? doc.body.textContent.trim() : '';
      }

      const term = stripHTML(setup.currentTerm);
      const context = stripHTML(setup.context) as ViewContext;

      updateSettings((v) => ({
        ...v,
        currentTerm: term,
        nextTerm: stripHTML(setup.nextTerm),
        context: context,
        cardType: stripHTML(setup.cardType),
        tags: (setup.tags || []).map(stripHTML),
        isAnki: !!setup.isAnki,
      }));
      if (context === "reviewAnswer") {
        termsHistory.add(term);
      }
    }
  },
  false,
);

window.parent.postMessage('ready', '*');

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://www.snowpack.dev/concepts/hot-module-replacement
if (import.meta && import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    app.$destroy();
  });
}
