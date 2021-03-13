<svelte:options immutable="{true}" />

<script lang="ts">
  import { autocomplete } from '@algolia/autocomplete-js';
  import type { AutocompleteSource } from '@algolia/autocomplete-js';
  import type { AutocompleteState } from '@algolia/autocomplete-core';

  import { fetchImages, searchSk, searchWK } from '../api';
  import type { ImageT, SkSearchResult } from '../types';
  import * as Router from '../router';
  import { searchState } from '../ctx';
  import { get } from 'svelte/store';

  const delay = (delay: number) =>
    new Promise((resolve) => setTimeout(resolve, delay));

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
  const imagesSource: Partial<AutocompleteSource<ImageT>> = {
    async getSuggestions() {
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

    templates: {
      item: ({ item }) => {
        return `<div class="media">
      <div class="media-left">
        <figure class="image is-32x32 justify-items-center is-flex is-justify-content-center is-align-content-center">
          <img src="${item.thumb_large}" alt="${item.name}">
        </figure>
      </div>
      <div class="media-content">
        <p class="subtitle is-6">${item.name}</p>
      </div>
    </div>`;
      },
    },
  };

  function getSuggestions<T>(source: Partial<AutocompleteSource<T>>): T[] {
    const all = get(searchState).suggestions;
    const idx = all.findIndex(
      (existing) => existing.source.getSuggestions === source.getSuggestions,
    );
    return (all[idx]?.items ?? []) as T[];
  }

  const closeIt = () => {
    searchState.update((v) => ({
      ...v,
      isOpen: false,
    }));
  };
  const skSource: Partial<AutocompleteSource<SkSearchResult>> = {
    onSelect({ suggestion }) {
      const id = suggestion.text;
      closeIt();
      requestAnimationFrame(() => {
        Router.push('main', { id: id });
      });
    },

    getInputValue({ suggestion }) {
      queryState.ignoreNext = true;
      return suggestion.text;
    },
    async getSuggestions() {
      if (!queryState.shouldFetch) {
        return getSuggestions<SkSearchResult>(skSource);
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

  const wkSource: Partial<AutocompleteSource<{ title: string }>> = {
    onSelect({ suggestion }) {
      const id = suggestion.title;
      closeIt();

      requestAnimationFrame(() => {
        Router.push('main', { id: id });
      });
    },

    getInputValue({ suggestion }) {
      queryState.ignoreNext = true;
      return suggestion.title;
    },
    async getSuggestions() {
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

  function getItemsCount(state: AutocompleteState<unknown>) {
    if (state.suggestions.length === 0) {
      return 0;
    }

    return state.suggestions.reduce(function (sum, suggestion) {
      return sum + suggestion.items.length;
    }, 0);
  }

  const installAutocomplete = (container: HTMLDivElement) => {
    document.addEventListener('keydown', (event) => {
      if ((event.key === 'k' && event.metaKey) || event.key === '/') {
        const htmlInputElement = container.querySelector<HTMLInputElement>(
          `#mainInput-input`,
        );
        if (document.activeElement !== htmlInputElement) {
          event.preventDefault();
        }
        htmlInputElement?.blur();
        htmlInputElement?.focus();
        htmlInputElement?.select();
      }
    });
    const ac = autocomplete<unknown>({
      container: container,
      enableCompletion: true,
      id: 'mainInput',
      initialState: {
        ...get(searchState),
      },
      onSubmit() {},
      dropdownPlacement: 'full-width',
      shouldDropdownShow(props) {
        return getItemsCount(props.state) > 0;
      },

      classNames: {
        completion: 'completion input is-large is-overlay',
        dropdown: 'dropdown absolute tile box p-0',
        section: 'tile is-parent section',
        menu: 'menu tile is-child is-primary',

        form: 'form',
        input: 'input is-large',
        inputWrapper: 'control has-icons-left has-icons-right',
        item: 'item p-2 my-1 cursor-pointer ',
        label: 'icon is-left',
        resetButton: 'icon is-right',
        root: 'root',
        sectionFooter: 'sectionFooter',
        sectionHeader: 'subtitle is-5 p-2 mb-1',
      },

      async getSources({ query, state }) {
        query = query.trim();
        if (lastQuery === query && query === state.query && state.isOpen) {
          return [];
        }
        if (queryState.ignoreNext) {
          queryState.ignoreNext = false;
          return [];
        }
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

        await delay(300);

        queryState.shouldFetch = lastQuery === query;
        if (!query) return [];

        return [skSource, wkSource, imagesSource] as any;
      },
    });
    const input = container.querySelector('input');
    input?.setAttribute('tabindex', '-1');
    input?.addEventListener('focus', () => {
      searchState.update((v) => ({
        ...v,
        isOpen: true,
      }));
    });
    input?.addEventListener('blur', () => {
      closeIt();
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
    return {
      destroy() {
        searchState.update((v) => ({
          ...v,
          suggestions: [],
          isOpen: false,
        }));
        ac.destroy();
      },
    };
  };
</script>

<div class="ac relative z-40" tabindex="-1" use:installAutocomplete></div>

<style>
  .ac :global([hidden]) {
    display: none;
    content: '';
  }

  .ac :global(.dropdown) {
    max-height: 80vh;
    top: 20px !important;
    overflow: auto;
  }

  .ac :global(.completion) {
    position: absolute;
    opacity: 0.2;
    pointer-events: none;
    z-index: 1;
  }

  .ac :global(button.icon) {
    pointer-events: initial;
  }

  .ac :global(.completion:empty) {
    display: none;
  }

  .ac :global([aria-selected='true']) {
    background-color: hsl(171, 100%, 41%);
  }

  .ac :global(input[type='search']::-ms-clear) {
    display: none;
    width: 0;
    height: 0;
  }

  .ac :global(input[type='search']::-ms-reveal) {
    display: none;
    width: 0;
    height: 0;
  }

  .ac :global(input[type='search']::-webkit-search-decoration),
  .ac :global(input[type='search']::-webkit-search-cancel-button),
  .ac :global(input[type='search']::-webkit-search-results-button),
  .ac :global(input[type='search']::-webkit-search-results-decoration) {
    display: none;
  }
</style>
