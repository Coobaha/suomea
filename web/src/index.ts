import { get } from 'svelte/store';
import type { ViewContext } from './types';
import { termsHistory, updateSettings, term as term$ } from './ctx';
import App from './App.svelte';

const app = new App({
  target: document.body,
});


let initialAnkiSetupDone = false;
window.addEventListener(
  'message',
  (event) => {
    if (event.data.type === 'update') {
      const setup = event.data.data;
      function stripHTML(html: string = ''): string {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent?.trim() ?? '';
      }

      const term = stripHTML(setup.currentTerm);
      const context = stripHTML(setup.context) as ViewContext;

      const prevTerm = get(term$);

      updateSettings((v) => {
        const nextState = {
          ...v,
          currentTerm: term,
          nextTerm: stripHTML(setup.nextTerm),
          context: context,
          cardType: stripHTML(setup.cardType),
          tags: (setup.tags || []).map(stripHTML),
          isAnki: !!setup.isAnki,
        };

        if (!v.isAnki && setup.isAnki && !initialAnkiSetupDone) {
          nextState.showAbout = false;
        }
        return nextState;
      });
      if (context === 'reviewAnswer') {
        termsHistory.add(term);
      }
      if (prevTerm !== term) {
        window.scrollTo(0, 0);
      }
    }
  },
  false,
);

window.parent.postMessage('ready', '*');

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    app.$destroy();
  });
}
