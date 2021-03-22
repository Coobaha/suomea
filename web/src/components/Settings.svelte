<script lang="ts">
  import 'quicksettings/quicksettings_white.css';
  import Settings from 'quicksettings';
  import {
    settingsSubscribe,
    updateSettings,
    term,
    nextTerm,
    isAnki,
    settings,
    termsHistory,
    ankiConnectURI,
  } from '../ctx';
  import { onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import type { ExtraLanguages, MyAnkiSetup, ViewContext } from '../types';
  import debounce from 'lodash/debounce';

  let currentTerm = $term;
  let nextTermStr = $nextTerm;
  let isDisabled = $isAnki;
  let ankiConnectUri = $ankiConnectURI;

  onMount(function initSettings() {
    Settings.useExtStyleSheet();
    const panel = Settings.create<MyAnkiSetup>(0, 0, '*');
    let ignoreNextUpdate = false;
    const handler = () => {
      debouncedHandler.cancel();
      ignoreNextUpdate = true;

      updateSettings((x) => {
        let json: MyAnkiSetup;
        try {
          json = panel.getValuesAsJSON();
        } catch (e) {
          return x;
        }
        const next = { ...x };
        Object.keys(json).forEach((key) => {
          const k = key as keyof MyAnkiSetup;
          const val: any = json[k];
          if (typeof val === 'object') {
            //@ts-ignore
            next[k] = val.value;
          } else {
            //@ts-ignore
            next[k] = json[k];
          }
        });
        return next;
      });
    };
    const debouncedHandler = debounce(handler, 350);

    const arrays = {
      context: [
        'reviewQuestion',
        'reviewAnswer',
        'clayoutQuestion',
        'clayoutAnswer',
        'previewQuestion',
        'previewAnswer',
      ] as ViewContext[],
      cardType: ['Forwards', 'Reversed'],
      extraLanguage: ['', 'ru'] as ExtraLanguages[],
    };
    const setCollapsed = (nextValue = true) => {
      updateSettings((prev) => ({ ...prev, isCollapsed: nextValue }));
    };
    panel
      .addText('currentTerm', currentTerm)
      .addText('nextTerm' as any, nextTermStr ?? '')
      .addText('ankiConnectURI' as any, ankiConnectUri)
      .addBoolean('isAnki', isDisabled)
      .addDropDown('context', arrays.context)
      .addDropDown('cardType', arrays.cardType)
      .addDropDown('extraLanguage', arrays.extraLanguage)
      .addButton('Hide', setCollapsed)
      .addButton('Update', handler)
      .addButton('Clear history', termsHistory.clear);

    const unsub = settingsSubscribe((settings) => {
      if (ignoreNextUpdate) {
        ignoreNextUpdate = false;
        return;
      }
      Object.keys(settings).forEach((key) => {
        const k = key as keyof MyAnkiSetup;
        const selectedVal = settings[k];
        //@ts-ignore
        const data: any = arrays[k];
        let valueToSet = selectedVal;
        if (data !== undefined) {
          let value = data.indexOf(selectedVal);
          if (value === 'true') {
            value = true;
          } else if (value === 'false') {
            value = false;
          }

          valueToSet = value;
        }
        try {
          panel.setValue(k, valueToSet);
        } catch {}
      });
      //@ts-ignore
      const isCollapsed: boolean = panel._collapsed;
      if (settings.isCollapsed) {
        panel.setWidth(20);
        !isCollapsed && panel.collapse();
      } else {
        panel.setWidth(200);
        isCollapsed && panel.expand();
      }
    });

    panel.setWidth(20);
    panel.setGlobalChangeHandler(debouncedHandler as any);
    const title: HTMLDivElement = (panel as any)._titleBar;
    title.addEventListener('dblclick', () => {
      const isCollapsed: boolean = (panel as any)._collapsed;
      setCollapsed(isCollapsed);
    });

    tick().then(() => {
      if (get(isAnki)) {
        panel.setWidth(20);
        try {
          panel.collapse();
        } catch (e) {}
      } else {
        if (get(settings).isCollapsed) {
          panel.setWidth(20);
          try {
            panel.collapse();
          } catch (e) {}
        } else {
          panel.setWidth(200);
          try {
            panel.expand();
          } catch (e) {}
        }
      }
    });

    return () => {
      unsub();
      panel.destroy();
    };
  });
</script>

<style>
  :global(.qs_main) {
    z-index: 100 !important;
    right: 5px;
    top: 5px !important;
    left: auto !important;
    position: fixed !important;
  }
</style>
