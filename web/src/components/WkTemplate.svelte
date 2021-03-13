<script lang="ts">
  import {
    viewContext,
    cardType,
    translation,
    decl,
    notes,
    possessive,
    synonyms,
    etymology,
    antonyms,
    derived,
    sk_en_translation,
    sk_ru_translation,
    term,
  } from '../ctx';

  import Images from './Images.svelte';
  import Nav from './Nav.svelte';
  import { isAnki } from '../ctx';
  import { get } from 'svelte/store';
  let regExpEscape = (s: string) => {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  };
  let isAnswer: boolean;
  let isQuestion: boolean;
  let isForwards: boolean;
  let isReversed: boolean;
  // let isReversedQuestion: boolean;

  $: isQuestion = $viewContext.includes('Question');
  $: isAnswer = $viewContext.includes('Answer');
  $: isForwards = $cardType === 'Forwards';
  $: isReversed = $cardType === 'Reversed';

  function sanitizeWk(html: string, term: string) {
    term = regExpEscape(term.replace(/^-/, ''));

    const decls = document.createElement('table');
    decls.innerHTML = get(decl);
    const allDecls = Array.from(
      new Set(
        Array.from(decls.querySelectorAll('td span'))
          .map((x) => (x instanceof HTMLElement ? x.innerText : ''))
          .filter(Boolean),
      ),
    )
      .map(regExpEscape)
      .join('|');
    if (allDecls) {
      return html.replace(
        new RegExp(`(${allDecls})`, 'gmi'),
        `<span class=blur>$1</span>`,
      );
    }
    html = html
      .replace(
        new RegExp(`(${term}[\\w|äöÿ]*)`, 'gmi'),
        `<span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`(${term.replace(/a/, 'ä')})`, 'gmi'),
        `<span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`(${term.replace(/o/, 'ö')})`, 'gmi'),
        `<span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`(${term.replace(/y/, 'ÿ')})`, 'gmi'),
        `<span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`(${term.substring(0, term.length - 1)}[a-z]+)`, 'gmi'),
        `<span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`form of ([\\w|äöÿ]+)`, 'gmi'),
        `form of <span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`participle of ([\\w|äöÿ]+)`, 'gmi'),
        `participle of <span class=blur>$1</span>`,
      );
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('.mention a').forEach((el) => {
      el.classList.add('blur');
    });

    return div.innerHTML;
  }
</script>

<svelte:head>
  <title>{$term ? `MyAnki - ${$term}` : 'MyAnki'}</title>
</svelte:head>

<div
  class:isForwards
  class:isReversed
  class:isAnswer
  class:isQuestion
  class="qa"
>
  <Nav>
    <slot />
  </Nav>

  <div
    data-internal-links
    class="tile is-ancestor  is-small has-text-left forwards-hidden"
  >
    <div class="tile is-parent">
      <article class="tile is-child message is-primary">
        <div class="message-header">Wiktionary</div>
        <div class="message-body max-h-96 overflow-auto wk">
          {@html $isAnki && isQuestion
            ? sanitizeWk($translation, $term)
            : $translation}
        </div>
      </article>
    </div>
    <div class="tile is-parent">
      <article class="tile is-child message is-primary">
        <div class="message-header">Sanakirja EN</div>
        <div class="message-body max-h-96 overflow-auto">
          {@html $sk_en_translation}
        </div>
      </article>
    </div>
    <div class="tile is-parent">
      <article class="tile is-child message is-primary">
        <div class="message-header">Sanakirja RU</div>
        <div class="message-body max-h-96 overflow-auto">
          {@html $sk_ru_translation}
        </div>
      </article>
    </div>
  </div>
  <div class="tile is-ancestor forwards-hidden">
    <div class="tile is-parent">
      <div class="tile is-child">
        <Images />
      </div>
    </div>
  </div>
  <div class="forwards-hidden reverse-hidden tile is-ancestor">
    {#if $decl || $possessive}
      <div class="tile is-parent is-8 is-vertical">
        {#if $decl}
          <div class="tile is-child">
            <table
              class="table is-narrow is-bordered is-striped is-fullwidth is-size-7"
            >
              {@html $decl}
            </table>
          </div>
        {/if}
        {#if $possessive}
          <div class="tile is-child">
            <table
              class="table is-narrow is-bordered is-striped is-fullwidth is-size-7"
            >
              {@html $possessive}
            </table>
          </div>
        {/if}
      </div>
    {/if}
    <div class="tile is-parent is-vertical">
      {#if $antonyms}
        <article class="tile is-child message is-danger">
          <div class="message-header">Antonyms</div>
          <div class="message-body">
            {@html $antonyms}
          </div>
        </article>
      {/if}
      {#if $synonyms}
        <article class="tile is-child message is-warning">
          <div class="message-header">Synonyms</div>
          <div class="message-body">
            {@html $synonyms}
          </div>
        </article>
      {/if}
      {#if $derived}
        <article class="tile is-child message is-info">
          <div class="message-header">Derived</div>
          <div class="message-body">
            {@html $derived}
          </div>
        </article>
      {/if}
      {#if $etymology}
        <article class="tile is-child message is-info">
          <div class="message-header">Etymology</div>
          <div class="message-body">
            {@html $etymology}
          </div>
        </article>
      {/if}
      {#if $notes}
        <article class="tile is-child message is-info">
          <div class="message-header">Notes</div>
          <div class="message-body">
            {@html $notes}
          </div>
        </article>
      {/if}
    </div>
  </div>
  <div class="forwards-hidden reverse-hidden">
    {#if $$slots.compounds}
      <div class="tile is-ancestor">
        <div class="tile is-parent">
          <div class="message container is-fullhd">
            <div class="message-header">Compounds</div>
            <div class="message-body is-justify-content-space-between">
              <slot name="compounds" />
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .qa :global(.blur) {
    background: currentColor;
    color: currentColor;
    opacity: 0.5;
  }

  .isForwards.isQuestion :global(.forwards-hidden),
  .isForwards.isQuestion :global(.forwards-hidden > *),
  .isReversed.isQuestion :global(.reverse-hidden),
  .isReversed.isQuestion :global(.reverse-hidden > *),
  .isForwards.isQuestion .forwards-hidden,
  .isForwards.isQuestion .forwards-hidden > *,
  .isReversed.isQuestion .reverse-hidden,
  .isReversed.isQuestion .reverse-hidden > * {
    filter: blur(4px);
    opacity: 0.3;
    transition: none;
    backface-visibility: visible;
  }

  .isForwards.isAnswer :global(.forwards-hidden),
  .isReversed.isAnswer :global(.reverse-hidden),
  .isForwards.isAnswer .forwards-hidden,
  .isReversed.isAnswer .reverse-hidden {
    filter: none;
    opacity: 1;
    transition: all 0.3s ease-in-out;
    backface-visibility: visible;
  }

  .wk :global(dl) {
    font-size: 12px;
    margin-left: 2em;
  }

  .wk :global(ul) {
    margin-top: 0;
  }
</style>