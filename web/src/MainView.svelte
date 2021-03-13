<!--https://github.com/algolia/autocomplete.js#features-->
<svelte:options immutable="{true}" />

<!--https://github.com/sveltejs/svelte/blob/master/src/compiler/compile/nodes/Element.ts-->
<script lang="typescript">
  import GlobalStyles from './components/GlobalStyles.svelte';

  import type { ImageT } from './types';

  import './api';
  import type { SanakirjaData, WiktionaryData } from './types';
  import * as Ctx from './ctx';
  import {
    term,
    nextTerm,
    updateSettings,
    isAnki,
    searchState,
    noteId,
    ankiNote,
    termsHistory,
    viewContext,
    cardType,
    nextNoteId,
  } from './ctx';
  import { ankiData, fetchImages, fetchSk, fetchWk } from './api';
  import Settings from './components/Settings.svelte';
  import WkTemplate from './components/WkTemplate.svelte';
  import { get } from 'svelte/store';
  import { getUrl, push } from './router';
  import qs from 'qs';
  import { fade, slide } from 'svelte/transition';
  import Typeahead from './components/Typeahead.svelte';
  import groupBy from 'lodash/groupBy';

  export let id: string;

  let controllers: AbortController[] = [];

  $: {
    if (id) {
      updateSettings((v) => ({
        ...v,
        currentTerm: decodeURIComponent(id),
      }));
    }
  }
  $: fetchAll($term, $noteId);
  $: warmupCache($term, $nextTerm);

  const cache = document.createElement('CACHE');
  cache.setAttribute(
    'style',
    'pointer-events: none;position:absolute;z-index:-1000; left: 100%;opacity:0;',
  );
  document.body.appendChild(cache);

  let isSearching: boolean;
  $: isSearching = $searchState.isOpen;

  function preloadImage(image: ImageT) {
    const img = new Image();
    img.src = image.thumb_large;
    img.setAttribute('style', 'position:absolute');
    cache.appendChild(img);
  }
  function updateHistory(id: string) {
    if (!updateHistory.ignoreNext) {
      termsHistory.add(id);
    }
    updateHistory.ignoreNext = false;
  }
  updateHistory.ignoreNext = false;
  $: updateHistory(id);
  $: grouped = Object.entries(
    groupBy($termsHistory, (record) =>
      new Date(record.timestamp).toLocaleDateString(),
    ),
  ).sort((a, b) => {
    const aKey = a[0];
    const bKey = b[0];

    return new Date(bKey).valueOf() - new Date(aKey).valueOf();
  });
  function handleWindowClick(event: MouseEvent) {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      if (target.dataset.globalUrlHandlerIgnore !== undefined) return;
      const externalHref = target.getAttribute('href') ?? '';
      const query = qs.parse(target.search.slice(1, -1));
      const wk =
        target.hash.startsWith('#Finnish') && target.pathname.split('/').pop();
      const sk = externalHref.includes('/search.php?id') && target.innerText;
      const handled = target.dataset.ankiId;
      let id = handled || sk || wk || query.title;

      if (!id) {
        if (
          target.closest('[data-internal-links]') &&
          target.hostname === 'en.wiktionary.org'
        ) {
          id = target.pathname.split('/').pop();
        }
      }
      if (id) {
        if (!target.dataset.ankiHref) {
          if (externalHref.startsWith('/search.php?')) {
            target.hostname = 'sanakirja.org';
          } else if (wk || query.title) {
            target.hostname = 'en.wiktionary.org';
          }
          target.setAttribute('data-anki-href', target.href);
        }

        const decodedId = decodeURIComponent(String(id));
        const params = {
          id: decodedId,
        };
        const internalHref = getUrl('main', params);
        target.setAttribute('data-anki-id', decodedId);

        if (!event.altKey) {
          target.href = internalHref;
          target.target = 'self';
        } else {
          target.href = target.dataset.ankiHref || externalHref;
          target.target = '_blank';
        }

        if (event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        push('main', params);
      }
    }
  }

  function warmupCache(currentTerm: string, nextTerm?: string) {
    if (nextTerm && currentTerm !== nextTerm && get(isAnki)) {
      cache.innerHTML = '';
      warmupCache.clear();
      const ctrl = new AbortController();
      const id = setTimeout(() => {
        fetchImages(nextTerm, ctrl).then((obj) => {
          if (!obj) {
            return;
          }
          let images = (obj as unknown) as ImageT[];
          images
            .filter((x) => !x.thumb_large.startsWith('http://'))
            .forEach(preloadImage);
        });
        fetchWk(nextTerm, ctrl);
        fetchSk(nextTerm, 'ru', ctrl);
        fetchSk(nextTerm, 'en', ctrl);
        let nextNodeId = get(nextNoteId) ?? 0;
        ankiData(
          nextNodeId > 0
            ? { id: nextNodeId }
            : {
                term: nextTerm,
              },
          ctrl,
        );
      }, 500);
      warmupCache.clear = () => {
        clearTimeout(id);
      };
    }
  }
  warmupCache.clear = () => {};

  function fetchAll(currentTerm: string, ankiNoteId: number) {
    Ctx.resetData();
    controllers.forEach((c) => c.abort());
    controllers.length = 0;

    const acquireController = () => {
      const c = new AbortController();
      controllers.push(c);
      return c;
    };
    const removeController = (c: AbortController) => {
      controllers = controllers.filter((existing) => existing !== c);
    };

    if (currentTerm) {
      const imagesController = acquireController();
      const wkController = acquireController();
      const enSkController = acquireController();
      const ruSkController = acquireController();
      const ankiDataCtrl = acquireController();

      fetchImages(currentTerm, imagesController).then((obj) => {
        removeController(imagesController);
        if (!obj) {
          return;
        }
        let x = ((obj as unknown) as ImageT[]) || [];

        const images = x.filter((x) => x.thumb_large.startsWith('https://'));
        images.forEach(preloadImage);
        Ctx.images.set(images);
      });
      fetchWk(currentTerm, wkController).then((obj) => {
        removeController(wkController);
        if (!obj) return;
        let x = (obj as unknown) as WiktionaryData;
        Ctx.translation.set(x.wk_translation ?? '');
        Ctx.url.set(x.wk_url ?? '');
        Ctx.decl.set(x.wk_decl ?? '');
        Ctx.notes.set(x.wk_notes ?? '');
        Ctx.possessive.set(x.wk_possessive ?? '');
        Ctx.synonyms.set(x.wk_synonyms ?? '');
        Ctx.etymology.set(x.etymology ?? '');
        Ctx.suffix.set(x.suffix ?? '');
        Ctx.compounds.set(x.compounds ?? '');
        Ctx.wordtype.set(x.wordtype ?? '');
        Ctx.antonyms.set(x.wk_antonyms ?? '');
        Ctx.derived.set(x.wk_derived ?? '');
        Ctx.wordMeta.set(x.meta);
      });
      fetchSk(currentTerm, 'en', enSkController).then((obj) => {
        removeController(enSkController);

        if (!obj) return;

        let x = (obj as unknown) as SanakirjaData;

        Ctx.sk_en_translation.set(x?.sk_translation ?? '');
        Ctx.sk_en_synonyms.set(x?.sk_synonyms ?? '');
        Ctx.sk_en_url.set(x?.sk_url ?? '');
      });
      fetchSk(currentTerm, 'ru', ruSkController).then((obj) => {
        removeController(ruSkController);
        if (!obj) return;

        let x = (obj as unknown) as SanakirjaData;
        Ctx.sk_ru_translation.set(x?.sk_translation ?? '');
        Ctx.sk_ru_synonyms.set(x?.sk_synonyms ?? '');
        Ctx.sk_ru_url.set(x?.sk_url ?? '');
      });

      ankiData(
        ankiNoteId > 0
          ? { id: ankiNoteId }
          : {
              term: currentTerm,
            },
        ankiDataCtrl,
      ).then((note) => {
        removeController(ankiDataCtrl);
        ankiNote.set(note);
      });
    }
  }

  $: isQuestion = $viewContext.includes('Question');
  $: isReversed = $cardType === 'Reversed';
</script>

<svelte:window on:click|capture="{handleWindowClick}" />

<GlobalStyles />
<Settings />

<div class="is-gapless columns is-mobile mb-0">
  <div class="hidden sm:block">
    <div
      class="panel is-primary column is-narrow rounded-none overflow-y-auto overflow-hidden has-background-white-bis sticky  hover:opacity-100 transition-opacity shadow  m-0"
      class:opacity-30="{$isAnki}"
      class:opacity-80="{!$isAnki}"
      style="width:200px;height: 100vh; top:0; border-radius: 0;"
    >
      {#each grouped as [label, records] (label)}
        <p class="panel-tabs">
          <!--svelte-ignore a11y-missing-attribute -->
          <a class="is-active">{label}</a>
        </p>

        {#each records as record (record.id)}
          <span
            transition:slide|local
            class="panel-block overflow-ellipsis overflow-hidden w-full"
            on:click="{() => {
              if (record.label) {
                updateHistory.ignoreNext = true;
                push('main', { id: record.label });
              }
            }}"
          >
            <!--svelte-ignore a11y-missing-attribute -->
            <a class:is-active="{$term === record.label}">
              <span
                class:hardblur="{$term === record.label &&
                  isQuestion &&
                  isReversed}"
              >
                {record.label || '¯\\_(ツ)_/¯'}
              </span>
            </a>
          </span>
        {/each}
      {/each}
    </div>
  </div>
  <div class="column">
    <div class:blur="{isSearching}" class="container is-fullhd p-3 qa">
      <WkTemplate>
        {#if !$isAnki}
          <!--suppress XmlInvalidId -->
          <label for="mainInput-input" class="icon cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path
                d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
                stroke="currentColor"
                fill="none"></path>
            </svg>
          </label>
        {/if}
      </WkTemplate>
    </div>
  </div>
</div>
{#key id}
  {#if !$isAnki}
    <div class:searchActive="{isSearching}" class="search-container">
      <div class="columns">
        <div class="column is-narrow" style="width:200px"></div>
        <div class="column">
          <div class="container px-3 my-3">
            <Typeahead />
          </div>
        </div>
      </div>
    </div>
  {/if}
{/key}

{#if isSearching}
  <div transition:fade class="overlay search-overlay"></div>
{/if}

<style>
  .qa {
    transition: filter 200ms ease;
  }
  :global(a.is-active) {
    color: #363636;
    cursor: default;
  }
  .blur {
    filter: blur(2px);
  }

  .hardblur {
    filter: blur(2px);
    background: currentColor;
    color: currentColor;
    opacity: 0.2;
  }

  .search-container {
    width: 0;
    height: 0;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
  }

  .searchActive {
    width: 100%;
    height: 100%;
    overflow: initial;
  }

  .search-overlay {
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 90;
    background-color: rgba(0, 0, 0, 0.1);
  }
</style>
