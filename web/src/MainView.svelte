<!--https://github.com/algolia/autocomplete.js#features-->
<svelte:options immutable="{true}" />

<!--https://github.com/sveltejs/svelte/blob/master/src/compiler/compile/nodes/Element.ts-->
<script lang="ts">
  import GlobalStyles from './components/GlobalStyles.svelte';
  import { slide, fly, fade } from 'svelte/transition';
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
    extraLanguage,
  } from './ctx';
  import { ankiData, fetchImages, fetchSk, fetchWk } from './api';
  import Settings from './components/Settings.svelte';
  import WkTemplate from './components/WkTemplate.svelte';
  import { get } from 'svelte/store';
  import { getUrl, push } from './router';
  import qs from 'qs';
  import Typeahead from './components/Typeahead.svelte';
  import groupBy from 'lodash/groupBy';
  import type { Route } from './router';
  import { onMount } from 'svelte';
  import { showAbout } from './ctx';
  import About from './About.svelte';
  import { expoInOut } from 'svelte/easing';
  export let id: string;
  export let route: Route | undefined = undefined;

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

  let isFirstRender = true;

  onMount(() => {
    isFirstRender = false;
  });

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
        target.hash.startsWith('#Finnish') &&
        (target.title || target.pathname.split('/').pop());
      const sk = externalHref.includes('/search.php?id') && target.innerText;
      const handled = target.dataset.ankiId;
      let id = handled || sk || wk || query.title;

      if (!id) {
        if (
          target.closest('[data-internal-links]') &&
          target.hostname.includes('.wiktionary.org')
        ) {
          id = target.title || target.pathname.split('/').pop();
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
          let images = obj as unknown as ImageT[];
          images
            .filter((x) => !x.thumb_large.startsWith('http://'))
            .forEach(preloadImage);
        });
        fetchWk(nextTerm, ctrl);
        fetchSk(nextTerm, 'en', ctrl);

        const lang = get(extraLanguage);
        lang && fetchSk(nextTerm, lang, ctrl);

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
      const ankiDataCtrl = acquireController();

      fetchImages(currentTerm, imagesController).then((obj) => {
        removeController(imagesController);
        if (!obj) {
          return;
        }
        let x = (obj as unknown as ImageT[]) || [];

        const images = x.filter((x) => x.thumb_large.startsWith('https://'));
        images.forEach(preloadImage);
        Ctx.images.set(images);
      });
      fetchWk(currentTerm, wkController).then((obj) => {
        removeController(wkController);
        if (!obj) return;
        let x = obj as unknown as WiktionaryData;
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

        let x = obj as unknown as SanakirjaData;

        Ctx.sk_en_translation.set(x?.sk_translation ?? '');
        Ctx.sk_en_synonyms.set(x?.sk_synonyms ?? '');
        Ctx.sk_en_url.set(x?.sk_url ?? '');
      });
      const lang = get(extraLanguage);
      if (lang) {
        const ruSkController = acquireController();
        fetchSk(currentTerm, lang, ruSkController).then((obj) => {
          removeController(ruSkController);
          if (!obj) return;

          let x = obj as unknown as SanakirjaData;
          Ctx.sk_ru_translation.set(x?.sk_translation ?? '');
          Ctx.sk_ru_synonyms.set(x?.sk_synonyms ?? '');
          Ctx.sk_ru_url.set(x?.sk_url ?? '');
        });
      }

      ankiData(
        ankiNoteId > 0
          ? { id: ankiNoteId }
          : {
              term: currentTerm,
            },
        ankiDataCtrl,
      )
        .then((note) => {
          removeController(ankiDataCtrl);
          ankiNote.set(note);
        })
        .catch((e) => {
          console.log('ankiData error', e);
        });
    }
  }

  $: isQuestion = $viewContext.includes('Question');
  $: isReversed = $cardType === 'Reversed';

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    const data = event.dataTransfer?.getData('text/plain');
    event.preventDefault();
    if (data && !data.match(/^https?/g)) {
      const params = {
        id: data.trim(),
      };
      push('main', params);
    }
  }

  function handleCogClick() {
    updateSettings((s) => ({ ...s, showAbout: !s.showAbout }));
  }
</script>

<svelte:window
  on:click|capture="{handleWindowClick}"
  on:dragover|capture="{handleDragOver}"
  on:drop|capture="{handleDrop}"
/>

<GlobalStyles />
<Settings />

<div class="mb-0 w-full  min-w-full flex">
  <div class="hidden xl:block">
    <div
      class="panel shadow-none is-primary column is-narrow rounded-none overflow-y-auto overflow-hidden has-background-white-bis sticky  hover:opacity-100 transition-opacity  m-0"
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
          <button
            transition:slide|local
            class="panel-block overflow-ellipsis overflow-hidden w-full"
            on:click="{() => {
              if (record.label) {
                updateHistory.ignoreNext = true;
                push('main', { id: record.label });
              }
            }}"
          >
            <span
              class="text-slate-500"
              class:text-slate-900="{$term === record.label}"
              class:hardblur="{$term === record.label &&
                isQuestion &&
                isReversed}"
            >
              {record.label || '¯\\_(ツ)_/¯'}
            </span>
          </button>
        {/each}
      {/each}
    </div>
  </div>
  <div class="w-full">
    <div class:blur="{isSearching}" class="p-3 qa">
      <WkTemplate>
        {#if !$isAnki}
          <div class="is-small">
            <!--suppress XmlInvalidId -->
            <label for="mainInput-input" class="button is-text m-0">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
                  stroke="currentColor"
                  fill="none"></path>
              </svg>
            </label>
          </div>
        {/if}
        <div class="is-small">
          <button class="button is-text m-0" on:click="{handleCogClick}">
            <div class="icon m-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                ><path
                  d="M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62594 2.36216 6.00481L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2354 10.9867C2.02367 11.3225 2.07267 11.7602 2.35341 12.041L2.95951 12.6471C3.24025 12.9278 3.67795 12.9768 4.01382 12.7651L4.92506 12.1907C5.26384 12.377 5.62516 12.5278 6.0039 12.6379L6.24198 13.6881C6.32977 14.0753 6.67391 14.3502 7.07095 14.3502H7.92809C8.32512 14.3502 8.66927 14.0753 8.75705 13.6881L8.99505 12.6383C9.37411 12.5282 9.73573 12.3773 10.0748 12.1909L10.986 12.7653C11.3218 12.977 11.7595 12.928 12.0403 12.6473L12.6464 12.0412C12.9271 11.7604 12.9761 11.3227 12.7644 10.9869L12.1902 10.076C12.3768 9.73688 12.5278 9.37515 12.638 8.99596L13.6879 8.75794C14.0751 8.67015 14.35 8.32601 14.35 7.92897V7.07183C14.35 6.6748 14.0751 6.33065 13.6879 6.24287L12.6381 6.00488C12.528 5.62578 12.3771 5.26414 12.1906 4.92507L12.7648 4.01407C12.9766 3.6782 12.9276 3.2405 12.6468 2.95975L12.0407 2.35366C11.76 2.07292 11.3223 2.02392 10.9864 2.23565L10.0755 2.80989C9.73622 2.62328 9.37437 2.47229 8.99505 2.36209L8.75705 1.31231C8.66927 0.925096 8.32512 0.650238 7.92809 0.650238H7.07095ZM4.92053 3.81251C5.44724 3.44339 6.05665 3.18424 6.71543 3.06839L7.07095 1.50024H7.92809L8.28355 3.06816C8.94267 3.18387 9.5524 3.44302 10.0794 3.81224L11.4397 2.9547L12.0458 3.56079L11.1882 4.92117C11.5573 5.44798 11.8164 6.0575 11.9321 6.71638L13.5 7.07183V7.92897L11.932 8.28444C11.8162 8.94342 11.557 9.55301 11.1878 10.0798L12.0453 11.4402L11.4392 12.0462L10.0787 11.1886C9.55192 11.5576 8.94241 11.8166 8.28355 11.9323L7.92809 13.5002H7.07095L6.71543 11.932C6.0569 11.8162 5.44772 11.5572 4.92116 11.1883L3.56055 12.046L2.95445 11.4399L3.81213 10.0794C3.4431 9.55266 3.18403 8.94326 3.06825 8.2845L1.50002 7.92897V7.07183L3.06818 6.71632C3.18388 6.05765 3.44283 5.44833 3.81171 4.92165L2.95398 3.561L3.56008 2.95491L4.92053 3.81251ZM9.02496 7.50008C9.02496 8.34226 8.34223 9.02499 7.50005 9.02499C6.65786 9.02499 5.97513 8.34226 5.97513 7.50008C5.97513 6.65789 6.65786 5.97516 7.50005 5.97516C8.34223 5.97516 9.02496 6.65789 9.02496 7.50008ZM9.92496 7.50008C9.92496 8.83932 8.83929 9.92499 7.50005 9.92499C6.1608 9.92499 5.07513 8.83932 5.07513 7.50008C5.07513 6.16084 6.1608 5.07516 7.50005 5.07516C8.83929 5.07516 9.92496 6.16084 9.92496 7.50008Z"
                  fill="currentColor"
                  fill-rule="evenodd"
                  clip-rule="evenodd"></path></svg
              >
            </div>
          </button>
        </div>
      </WkTemplate>
    </div>
  </div>
  {#if $showAbout}
    <div
      class="xl:max-w-24xl bg-slate-50 xl:sticky top-0 fixed left-0 z-30 bottom-0 max-h-screen"
      transition:fly="{{
        duration: isFirstRender ? 0 : 200,
        x: 500,
        opacity: 0.3,
        easing: expoInOut,
      }}"
    >
      <About />
    </div>
  {/if}
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
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 50;
    background-color: rgba(0, 0, 0, 0.1);
  }
</style>
