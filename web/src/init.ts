// import(
//   // @ts-ignore
//   'https://markknol.github.io/console-log-viewer/console-log-viewer.js?align=bottom'
// )
//   .catch(alert)
//   .then(() => {
//     init();
//     console.log('======================\n');
//     console.log(window.location.toString());
//   });
import type { MyAnkiSetup } from './types';

function init() {
  let target = document.getElementById('myankitarget');

  if (!target) {
    target = document.createElement('div');
    target.id = 'myankitarget';
    document.body.appendChild(target);
  }

  const iframe = document.createElement('iframe');

  iframe.setAttribute(
    'src',
    `${import.meta.env.SNOWPACK_PUBLIC_BASE ?? ''}/${
      import.meta.env.SNOWPACK_PUBLIC_BASE_NAME ?? ''
    }`,
  );
  iframe.setAttribute('id', `ankiFrame`);
  iframe.setAttribute('style', `height:100vh; width: 100%`);
  iframe.setAttribute('frameborder', `0`);

  target.append(iframe);

  let lastUpdate: MyAnkiSetup | undefined;
  let isReady = false;

  const updateAnki = (data: MyAnkiSetup) => {
    if (!isReady) {
      lastUpdate = data;
      return;
    }
    lastUpdate = undefined;
    if (iframe.contentWindow) {
      const payload = { ...data };
      Object.keys(data).forEach((key) => {
        const k = (key as unknown) as keyof typeof payload;
        if (payload[k] === null) {
          delete payload[k];
        }
      }, payload);

      iframe.contentWindow.postMessage(
        {
          type: 'update',
          data: payload,
        },
        '*',
      );
    }
  };

  window.addEventListener(
    'message',
    (event) => {
      if (event.origin !== import.meta.env.SNOWPACK_PUBLIC_BASE) return;
      if (event.data === 'ready') {
        isReady = true;
        if (lastUpdate) {
          updateAnki(lastUpdate);
        }
      }
      // ...
    },
    false,
  );
  window.myAnkiUpdate = updateAnki;

  const setup: MyAnkiSetup = window.myAnkiSetup || {
    currentTerm: '',
    context: 'reviewQuestion',
    tags: ['verb'],
    cardType: 'Reversed',
    isAnki: false,
    id: -1,
  };

  updateAnki(setup);
}

function ready(callback: () => void) {
  var state = document.readyState;
  if (state === 'complete' || state === 'interactive') {
    return setTimeout(callback, 0);
  }

  document.addEventListener('DOMContentLoaded', function onLoad() {
    callback();
  });
}

ready(() => {
  try {
    init();
  } catch (e) {
    alert(e);
    throw e;
  }
});
export {};
