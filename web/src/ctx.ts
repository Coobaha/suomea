import { writable, derived as derived$, get } from 'svelte/store';
import type {
  ImageT,
  MyAnkiSetup,
  WiktionaryData,
  Note,
  AnkiPluginConfig,
} from './types';
import store from 'store';
import type { AutocompleteState as AutocompleteCoreState } from '@algolia/autocomplete-core';
import uniqBy from 'lodash/uniqBy';
import { isConnected } from './anki_actions';

type Settings = MyAnkiSetup & {
  isCollapsed: boolean;
  themedTags: string[];
  ankiConnectURI: string;
  ankiConnected: boolean;
};

const defaultSettings: Settings = {
  currentTerm: '',
  isCollapsed: true,
  nextTerm: '',
  context: 'reviewAnswer',
  cardType: 'Forwards',
  tags: [],
  themedTags: [],
  id: -1,
  nextId: -1,
  isAnki: false,
  ankiConnected: false,
  ankiConnectURI: 'http://localhost:8765/',
  extraLanguage: 'ru'
};

let storedSettings: Settings = Object.assign(
  {},
  defaultSettings,
  store.get('settings'),
);
if (storedSettings.nextTerm === 'null') {
  storedSettings.nextTerm = '';
}

export const settings = writable<Settings>(storedSettings);
export const ankiConnectURI = derived$(
  settings,
  (values) => values.ankiConnectURI,
);
export const pluginSettings = derived$(
  ankiConnectURI,
  (uri, set) => {
    const ctrl = new AbortController();

    isConnected(ctrl).then((pluginSettings) => {
      if ('error' in pluginSettings) return;
      settings.update((s) => ({ ...s, ankiConnected: pluginSettings.enabled }));
      set(pluginSettings);
    });
    return () => {
      ctrl.abort();
    };
  },
  { enabled: false } as AnkiPluginConfig,
);

export const ankiConnected = derived$(
  settings,
  (settings) => settings.ankiConnected,
);

pluginSettings.subscribe(() => {});

export const termsHistory = (() => {
  const s = writable<{ label: string; id: string; timestamp: number }[]>(
    store.get('history', []),
  );

  s.subscribe((value) => {
    store.set('history', value);
  });
  let ignoreNext = false;
  window.addEventListener(
    'popstate',
    function (event) {
      // The popstate event is fired each time when the current history entry changes.
      ignoreNext = true;
    },
    false,
  );

  return {
    subscribe: s.subscribe,
    add: function (term: string) {
      if (!term) return;
      const label = decodeURIComponent(term);
      const termHistoryRecord = {
        label: label,
        id: `${label}_${new Date().toDateString()}`,
        timestamp: Date.now(),
      };

      s.update((value) => {
        if (ignoreNext) {
          ignoreNext = false;
          return value;
        }
        return uniqBy([termHistoryRecord, ...value], 'id');
      });
    },
    clear() {
      s.update(() => []);
    },
  };
})();

export const ankiNote = writable<Note | undefined>(undefined);

export const settingsSubscribe = settings.subscribe;

export const updateSettings = (updater: (value: Settings) => Settings) =>
  settings.update(updater);

settings.subscribe((value) => {
  const vals = { ...value, tags: [] as string[] };
  Object.keys(vals).forEach((key) => {
    const k = (key as unknown) as keyof typeof vals;
    if (vals[k] === null) {
      delete vals[k];
    }
  }, vals);
  store.set('settings', vals);
});

export const cardType = derived$(settings, (values) => values.cardType);
export const themedTags = derived$(settings, (values) => values.themedTags);
export const term = derived$(settings, (values) => values.currentTerm);

export const noteId = derived$(settings, (values) => values.id);
export const nextNoteId = derived$(settings, (values) => values.nextId);
export const nextTerm = derived$(settings, (values) => values.nextTerm);
export const viewContext = derived$(settings, (values) => values.context);

export const isAnki = derived$(settings, (values) => values.isAnki);
export const extraLanguage = derived$(
  settings,
  (values) => values.extraLanguage,
);

// data
export const ownAnswer = writable<string>('');
export const translation = writable<string>('');
export const url = writable<string>('');
export const decl = writable<string>('');
export const notes = writable<string>('');
export const possessive = writable<string>('');
export const synonyms = writable<string>('');
export const etymology = writable<string>('');
export const suffix = writable<string>('');
export const compounds = writable<string>('');
export const wordtype = writable<string>('');
export const antonyms = writable<string>('');
export const derived = writable<string>('');
export const sk_en_translation = writable<string>('');
export const sk_en_synonyms = writable<string>('');
export const sk_en_url = writable<string>('');
export const sk_ru_translation = writable<string>('');
export const sk_ru_synonyms = writable<string>('');
export const sk_ru_url = writable<string>('');
export const wordMeta = writable<WiktionaryData['meta']>({});

export const images = writable<ImageT[]>([]);
export const searchState = writable<AutocompleteCoreState<unknown>>({
  highlightedIndex: null,
  query: '',
  completion: null,
  suggestions: [],
  isOpen: false,
  status: 'idle',
  statusContext: {},
  context: {},
});

export const tags = derived$(
  [settings, wordtype, wordMeta, ankiNote],
  ([values, wordtype, meta, ankiNote]): string[] => {
    return Array.from(
      new Set([
        ...values.tags,
        ...wordtype.split(/[,\s+]/gm),
        ...(ankiNote?.tags ?? []),
        meta?.verb && `verbit${meta?.verb?.type}`,
      ]),
    )
      .filter((val): val is string => !!val)
      .map((s) => s.trim());
  },
);
//data end
export const resetData = () => {
  translation.set('');
  ownAnswer.set('');
  url.set('');
  decl.set('');
  notes.set('');
  possessive.set('');
  synonyms.set('');
  etymology.set('');
  suffix.set('');
  compounds.set('');
  wordtype.set('');
  antonyms.set('');
  derived.set('');
  sk_en_translation.set('');
  sk_en_synonyms.set('');
  sk_en_url.set('');
  sk_ru_translation.set('');
  sk_ru_synonyms.set('');
  sk_ru_url.set('');
  images.set([]);
  wordMeta.set({});
  ankiNote.set(undefined);
};

ankiNote.subscribe((note) => {
  ownAnswer.set(note?.fields.own_answer?.value ?? '');
});
