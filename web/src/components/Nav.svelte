<svelte:options immutable="{true}" />

<script lang="ts">
  import {
    url,
    term,
    sk_en_url,
    sk_ru_url,
    tags,
    viewContext,
    cardType,
    themedTags,
    isAnki,
    ownAnswer,
    updateSettings,
    ankiNote,
    sk_ru_translation,
    sk_en_translation,
    translation,
    ankiConnected,
    extraLanguage,
  } from '../ctx';
  import { getUrl } from '../router';
  import { saveTerm } from '../api';
  import { get } from 'svelte/store';

  import TagsInput from './TagsInput.svelte';

  let isLoading = false;
  let didSubmit = false;
  let submittedTerm = '';
  let editedTags: string[] = $tags.slice();
  let prevTags: string[] = [];

  function resetTags() {
    editedTags = get(tags).slice();
  }

  function mergeTags(next: string[]) {
    const prev = new Set(prevTags || []);
    editedTags = Array.from(
      new Set(editedTags.filter((tag) => !prev.has(tag)).concat(next)),
    );
  }

  $: $term, resetTags();
  $: mergeTags($tags);

  $: isSaved = didSubmit && !isLoading && submittedTerm === $term;
  $: handleSubmit = async function handleSubmit() {
    const currentTerm = get(term);
    const persistedTags = get(themedTags);
    const currentTags = get(tags).slice().sort();
    const nextTags = Array.from(
      new Set([...editedTags, ...persistedTags]),
    ).sort();
    const isSame =
      submittedTerm === currentTerm &&
      currentTags.join('___') === nextTags.join('___');
    if (isLoading || isSame) return;
    isLoading = true;
    didSubmit = false;
    submittedTerm = currentTerm;

    await saveTerm({
      term: currentTerm,
      tags: nextTags,
      own_answer: get(ownAnswer),
      meaning: [
        get(sk_ru_translation),
        get(sk_en_translation),
        get(translation),
      ].join(' '),
    }).catch((e) => {
      setTimeout(() => {
        throw e;
      }, 0);
    });
    didSubmit = true;
    isLoading = false;
  };
  let isQuestion: boolean;
  let isReversed: boolean;
  let isReversedQuestion: boolean;

  $: isQuestion = $viewContext.includes('Question');
  $: isReversed = $cardType === 'Reversed';

  $: isReversedQuestion = isReversed && isQuestion;

  function handleTags(event: CustomEvent<{ tags: string[] }>) {
    editedTags = event.detail.tags;
  }

  function handleThemedTags(event: CustomEvent<{ tags: string[] }>) {
    const themedTags1 = event.detail.tags;
    updateSettings((v) => {
      return { ...v, themedTags: themedTags1 };
    });
  }

  import { wordMeta } from '../ctx';

  let extraTags: string[];
  $: {
    let meta = $wordMeta;
    if (Object.keys(meta).length) {
      extraTags = [
        meta.syllabification ? `syllabification: ${meta.syllabification}` : '',
        meta.gradation ? `gradation: ${meta.gradation}` : 'gradation: none',
        meta.kotus &&
          `kotus: ${meta.kotus} ${meta.kotus_word ? meta.kotus_word : ''}`,
      ].filter((val): val is string => !!val);
    } else {
      extraTags = [];
    }
    if (!!$ankiNote && !$isAnki) {
      extraTags.unshift('in anki');
    }
  }
</script>

<nav
  class="columns navbar reverse-hidden"
  aria-label="main navigation"
>
  {#if $isAnki}
    <!--suppress HtmlUnknownTarget -->
    <a
      class="navbar-brand is-flex-direction-column"
      href="{getUrl('main', { id: $term })}"
    >
      <h1 class="navbar-item title m-0" class:invisible="{isReversedQuestion}">
        {$term}
      </h1>
    </a>
  {:else}
    <h1
      tabindex="0"
      class="navbar-item title m-0"
      class:invisible="{isReversedQuestion}"
    >
      {$term}
    </h1>
  {/if}

  <div class="navbar-menu ml-auto is-active forwards-hidden">
    <div class="navbar-end buttons" style="width: 100%">
      {#if $ankiConnected && !$isAnki}
        <div class="navbar-item">
          <form
            on:submit|preventDefault="{handleSubmit}"
            class:invisible="{isQuestion}"
          >
            <button
              type="submit"
              id="saveButton"
              tabindex="0"
              class:is-success="{didSubmit && !isLoading}"
              class="button is-larg is-primary m-0"
              style="min-width:88px;"
            >
              {#if isSaved}Saved!
              {:else if $ankiNote}
                Update
              {:else}
                Save
              {/if}
            </button>
          </form>
        </div>
      {/if}
      <a
        class="navbar-item is-info"
        target="_blank"
        data-global-url-handler-ignore
        href="{$url}">Wiktionary</a
      >
      <a
        class="navbar-item is-info"
        target="_blank"
        data-global-url-handler-ignore
        href="{$sk_en_url}">Sanakirja EN</a
      >
      {#if $extraLanguage && $extraLanguage.length}
        <a
          class="navbar-item is-info"
          target="_blank"
          data-global-url-handler-ignore
          href="{$sk_ru_url}">Sanakirja RU</a
        >
      {/if}

      <div class="navbar-item">
        <slot />
      </div>
    </div>
  </div>
</nav>
<div class="mb-2 reverse-hidden">
  <div class="flex">
    <TagsInput
      placeholder="Term tags"
      name="tags"
      id="tags"
      tagClassname="is-light is-primary"
      tags="{editedTags}"
      on:tags="{handleTags}"
      disable="{$isAnki || !$ankiConnected}"
      hiddenInput="{$isAnki}"
    />

    {#if !$isAnki && $ankiConnected}
      <div class="ml-auto">
        <TagsInput
          placeholder="Session tags"
          name="themedTags"
          id="themedTags"
          tagClassname="is-light is-info"
          tags="{$themedTags}"
          layoutReversed="{true}"
          on:tags="{handleThemedTags}"
        />
      </div>
    {/if}
  </div>

  {#if extraTags.length}
    <div class="mt-1">
      <div class="col">
        <TagsInput
          tagClassname="is-light is-info"
          tags="{extraTags}"
          disable="{true}"
          hiddenInput="{true}"
        />
      </div>
    </div>
  {/if}
</div>
<div class="mb-3 forwards-hidden justify-center align-items-center">
  {#if $isAnki}
    <div
      class="my-3 textarea is-primary is-small has-fixed-size"
      class:is-hidden="{$ownAnswer.length === 0}"
      rows="{$ownAnswer.split('\n').length}"
    >
      {@html $ownAnswer}
    </div>
  {:else if $ankiConnected && !$isAnki}
    <div
      contenteditable="true"
      class="my-3 textarea is-primary is-small has-fixed-size"
      bind:innerHTML="{$ownAnswer}"
      data-placeholder="Write your notes.."
      rows="{$ownAnswer.split('\n').length}"
    ></div>
  {/if}
</div>

<style>
  [contenteditable]:empty::before {
    content: attr(data-placeholder);
    color: dimgrey;
    opacity: 0.3;
  }
</style>
