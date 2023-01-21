<svelte:options immutable="{true}" />

<script lang="ts">
  import { autocomplete } from '@algolia/autocomplete-js';
  import type { VNode, AutocompleteSource } from '@algolia/autocomplete-js';
  import '@algolia/autocomplete-theme-classic';
  import { fetchImages, searchSk, searchWK } from '../api';
  import type { ImageT, SkSearchResult } from '../types';
  import * as Router from '../router';
  import { searchState } from '../ctx';
  import { get } from 'svelte/store';

  const createTasks = () => {
    let controllers: AbortController[] = [];

    const acquireController = () => {
      const c = new AbortController();
      controllers.push(c);
      return c;
    };
    const removeController = (c: AbortController) => {
      controllers = controllers.filter((existing) => existing !== c);
    };

    return {
      async run<T = any>(
        runner: (c: AbortController) => Promise<T>,
      ): Promise<T> {
        const c = acquireController();
        try {
          return await runner(c);
        } finally {
          removeController(c);
        }
      },
      reset() {
        controllers.forEach((c) => c.abort());
        controllers.length = 0;
      },
    };
  };

  const tasks = createTasks();
  let lastQuery: string = '';
  let queryState: {
    ignoreNext: boolean;
    query: string;
    lang: 'en' | 'ru' | 'fi';
    shouldFetch: boolean;
  } = {
    query: '',
    lang: 'fi',
    shouldFetch: true,
    ignoreNext: false,
  };

  let loaders = {
    images: false,
    sk: false,
  };
  const imagesSource: AutocompleteSource<Record<string, unknown> & ImageT> = {
    async getItems() {
      if (!queryState.shouldFetch) {
        return getSuggestions(imagesSource);
      }

      loaders.images = true;

      const images = await tasks.run((ctrl) =>
        fetchImages(queryState.query, ctrl),
      );

      loaders.images = false;

      return images
        .filter((x) => x.thumb_large.startsWith('https://'))
        .slice(0, 10);
    },

    onSelect({ item }) {
      const id = item.name;
      closeIt();
      requestAnimationFrame(() => {
        Router.push('main', { id: id });
      });
    },

    sourceId: 'images',
    getItemInputValue({ item }) {
      return item.name;
    },
    templates: {
      item: ({ html, item }) => {
        return html`<div class="media">
          <div class="media-left">
            <figure
              class="image is-32x32 justify-items-center is-flex is-justify-content-center is-align-content-center overflow-hidden"
            >
              <img src="${item.thumb_large}" alt="${item.name}" />
            </figure>
          </div>
          <div class="media-content">
            <p class="subtitle is-6">${item.name}</p>
          </div>
        </div>`;
      },
    },
  };

  function getSuggestions<T extends Record<string, unknown>>(
    source: AutocompleteSource<T>,
  ): T[] {
    const all = get(searchState).collections;
    const idx = all.findIndex(
      (existing) => existing.source.sourceId === source.sourceId,
    );
    return (all[idx]?.items ?? []) as T[];
  }

  const closeIt = () => {
    searchState.update((v) => ({
      ...v,
      isOpen: false,
    }));
  };
  const skSource: AutocompleteSource<
    SkSearchResult & { [k: string]: unknown }
  > = {
    sourceId: 'sk',

    onSelect({ item }) {
      const id = item.text;
      closeIt();
      requestAnimationFrame(() => {
        Router.push('main', { id: id });
      });
    },

    getItemUrl({ item }) {
      return Router.getUrl('main', { id: item.text });
    },
    getItemInputValue({ item }) {
      // queryState.ignoreNext = true;
      return item.text;
    },
    async getItems() {
      if (!queryState.shouldFetch) {
        return getSuggestions(skSource) as unknown as any;
      }

      loaders.sk = true;
      const result = await tasks.run((ctrl) =>
        searchSk(queryState.query, queryState.lang, ctrl),
      );
      loaders.sk = false;
      return result;
    },

    templates: {
      item({ item }) {
        return item.text;
      },
    },
  };

  const wkSource: AutocompleteSource<{ title: string }> = {
    sourceId: 'wk',
    getItemUrl({ item }) {
      return Router.getUrl('main', { id: item.title });
    },
    onSelect({ item }) {
      const id = item.title;
      closeIt();

      requestAnimationFrame(() => {
        Router.push('main', { id: id });
      });
    },

    getItemInputValue({ item }) {
      queryState.ignoreNext = true;
      return item.title;
    },
    async getItems() {
      if (!queryState.shouldFetch) {
        return getSuggestions(wkSource);
      }

      loaders.sk = true;
      const result = await tasks.run((ctrl) =>
        searchWK(queryState.query, ctrl),
      );
      loaders.sk = false;
      return result.results.slice(0, 13).map((title) => ({ title }));
    },

    templates: {
      item({ item }) {
        return item.title;
      },
    },
  };

  const installAutocomplete = (container: HTMLDivElement) => {
    document.addEventListener('keydown', (event) => {
      if (
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        event.key === '/' ||
        event.key === '.'
      ) {
        const htmlInputElement =
          container.querySelector<HTMLInputElement>(`#mainInput-input`);
        // elements where user can type, input textarea etc
        const els = new Set(['input', 'textarea']);
        const focused = document.activeElement;
        if (focused !== htmlInputElement) {
          if (focused?.getAttribute('contenteditable') === 'true') {
            return;
          }
          const tagName = focused?.tagName.toLowerCase();

          if (tagName && els.has(tagName)) {
            if (tagName === 'textarea') {
              return;
            }
            const inputs = new Set(['text', 'search', 'url', 'tel', 'email']);
            const inputType = focused?.getAttribute('type');
            if (inputType && inputs.has(inputType)) {
              return;
            }
          }
          event.preventDefault();
        }
        htmlInputElement?.blur();
        htmlInputElement?.focus();
        htmlInputElement?.select();
      }
    });
    const ac = autocomplete<Record<string, unknown>>({
      container: container.querySelector('div[data-input]') as HTMLDivElement,
      panelContainer: container.querySelector(
        'div[data-panel]',
      ) as HTMLDivElement,
      panelPlacement: 'full-width',
      id: 'mainInput',
      initialState: {
        ...get(searchState),
      },
      detachedMediaQuery: 'none',

      navigator: {
        navigate(params) {
          Router.pushUrl(params.itemUrl);
        },
      },
      async getSources(state) {
        const query = state.query.trim();
        lastQuery = query;
        queryState.query = query;

        if (query.match(/^[.,/]/gim)) {
          queryState.lang = 'en';
          queryState.query = query.slice(1).trim();
        } else if (query.match(/^[а-я]/gim)) {
          queryState.lang = 'ru';
        } else {
          queryState.lang = 'fi';
        }

        tasks.reset();

        queryState.shouldFetch = lastQuery === query;
        if (!query) return [];

        return [skSource, wkSource, imagesSource] as any;
      },
      reshape({ sources, state }) {
        const seen = new Set<string>();

        return sources.map((source) => {
          if (source.sourceId === imagesSource.sourceId) return source;
          const items = source.getItems().filter((item) => {
            const id = source.getItemInputValue?.({ item, state }) ?? '';
            const hasSeen = seen.has(id);
            seen.add(id);
            return !hasSeen;
          });

          return {
            ...source,
            getItems() {
              return items;
            },
          };
        });
      },
      render({ sections, html, render }, root) {
        const vnode = html`<div
          class="aa-PanelLayout aa-Panel--scrollable tile is-parent"
        >
          ${sections}
        </div>` as VNode;
        return render(vnode, root);
      },
    });
    const input = container.querySelector('input');
    input?.setAttribute('tabindex', '-1');
    input?.addEventListener('focus', () => {
      if (!get(searchState).isOpen) {
        searchState.update((v) => ({
          ...v,
          isOpen: true,
        }));
      }
    });
    input?.addEventListener('blur', (e) => {
      if (
        e.relatedTarget instanceof Node &&
        container.contains(e.relatedTarget)
      ) {
        return;
      }

      closeIt();
      ac.setIsOpen(false);
      requestAnimationFrame(() => {
        const element = document.querySelector('h1.title');
        if (element instanceof HTMLElement) {
          element.focus();
        }
      });
    });
    let prevValue = input?.value;
    input?.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        if (!prevValue && !target.value && event.key === 'Escape') {
          input.blur();
        }
        prevValue = target.value;
      }
    });

    const unsub = searchState.subscribe((state) => {
      if (!state.isOpen) {
        ac.setIsOpen(false);
        ac.setQuery('');
        if (input) {
          input.value = '';
          input.blur();
        }
        return;
      }
      ac.setQuery(state.query);
      if (input) {
        input.value = state.query;
        input.select();
        input.focus();
      }
      ac.refresh();
    });
    return {
      destroy() {
        unsub();
        searchState.update((v) => ({
          ...v,
          collections: [],
          isOpen: false,
        }));
        ac.destroy();
      },
    };
  };
</script>

<div class="ac relative z-40" tabindex="-1" use:installAutocomplete>
  <div data-input></div>
  <div data-panel></div>
</div>

<style>
  [data-panel] :global(.aa-Panel) {
    top: inherit !important;
  }
</style>
