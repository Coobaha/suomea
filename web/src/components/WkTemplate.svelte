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
  import { isAnki, extraLanguage } from '../ctx';
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
    const isSuffix = term.startsWith('-');
    term = regExpEscape(term.replace(/^-/, ''));

    const decls = document.createElement('table');
    decls.innerHTML = get(decl);
    const allDecls = Array.from(
      new Set(
        Array.from(decls.querySelectorAll('td span,td b'))
          .map((x) => {
            if (!(x instanceof HTMLElement)) return '';
            const anchor = x.querySelector('a');
            if (anchor && anchor.title) {
              return anchor.title;
            }
            return x.innerText;
          })
          .filter(Boolean),
      ),
    ).reverse();

    if (isSuffix) {
      const suffixes = new Set([
        term,
        '-' + term,

        term.replace(/ä/gim, 'a'),
        term.replace(/ö/gim, 'o'),
        term.replace(/ÿ/gim, 'y'),

        term.replace(/a/gim, 'ä'),
        term.replace(/o/gim, 'ö'),
        term.replace(/y/gim, 'ÿ'),
      ]);
      allDecls.push(...suffixes);
    }

    const allDeclsEscaped = allDecls.map(regExpEscape).join('|');

    if (allDeclsEscaped) {
      html = html.replace(
        new RegExp(`(${allDeclsEscaped})`, 'gmi'),
        `<span class=blur>$1</span>`,
      );
    } else {
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
        );
    }

    const div = document.createElement('div');
    div.innerHTML = html
      .replace(
        new RegExp(`form of ([\\w|äöÿ]+)`, 'gmi'),
        `form of <span class=blur>$1</span>`,
      )
      .replace(
        new RegExp(`participle of ([\\w|äöÿ]+)`, 'gmi'),
        `participle of <span class=blur>$1</span>`,
      );

    div.querySelectorAll('.use-with-mention .mention a').forEach((el) => {
      el.classList.add('blur');
    });

    if (allDeclsEscaped) {
      div.querySelectorAll<HTMLElement>('dd i').forEach((el) => {
        const text = el.innerText;
        if (text.match(allDeclsEscaped)) {
          Array.from(el.children).forEach((child) => {
            if (
              child instanceof HTMLElement &&
              allDecls.indexOf(child.innerText)
            ) {
              const blurred = [];
              let next: ChildNode | null = child;
              let search = '';
              while (next instanceof HTMLElement) {
                const nextSearch = search + next.innerText;
                if (allDecls.find((decl) => decl.startsWith(nextSearch))) {
                  if (!blurred.length) {
                    blurred.push(child);
                  }
                  blurred.push(next);
                  next = next.nextSibling;
                  search = nextSearch;
                } else if (blurred.length) {
                  break;
                } else {
                  next = next.nextSibling;
                }
              }
              blurred.forEach((el) => el.classList.add('blur'));
            }
          });
        }
      });
    }

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
        <div class="message-body max-h-96 overflow-auto wk content">
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
    {#if $extraLanguage && $extraLanguage.length}
      <div class="tile is-parent">
        <article class="tile is-child message is-primary">
          <div class="message-header">
            Sanakirja {$extraLanguage.toUpperCase()}
          </div>
          <div class="message-body max-h-96 overflow-auto">
            {@html $sk_ru_translation}
          </div>
        </article>
      </div>
    {/if}
  </div>
  <div class="tile is-ancestor forwards-hidden">
    <div class="tile is-parent">
      <div class="tile is-child">
        <Images />
      </div>
    </div>
  </div>
  <div class="forwards-hidden reverse-hidden columns">
    {#if $decl || $possessive}
      <div class="column is-two-thirds">
        {#if $decl}
          <table
            class="table is-narrow is-bordered is-striped is-fullwidth is-size-7"
          >
            {@html $decl}
          </table>
        {/if}
        {#if $possessive}
          <table
            class="table is-narrow is-bordered is-striped is-fullwidth is-size-7"
          >
            {@html $possessive}
          </table>
        {/if}
      </div>
    {/if}
    <div class="column">
      {#if $antonyms}
        <article class="message is-danger">
          <div class="message-header">Antonyms</div>
          <div class="message-body">
            {@html $antonyms}
          </div>
        </article>
      {/if}
      {#if $synonyms}
        <article class="message is-warning">
          <div class="message-header">Synonyms</div>
          <div class="message-body">
            {@html $synonyms}
          </div>
        </article>
      {/if}
      {#if $derived}
        <article class="message is-info">
          <div class="message-header">Derived</div>
          <div class="message-body">
            {@html $derived}
          </div>
        </article>
      {/if}
      {#if $etymology}
        <article class="message is-info">
          <div class="message-header">Etymology</div>
          <div class="message-body">
            {@html $etymology}
          </div>
        </article>
      {/if}
      {#if $notes}
        <article class="message is-info">
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

  .isForwards.isQuestion .forwards-hidden *,
  .isReversed.isQuestion .reverse-hidden * {
    overflow: hidden;
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
    margin-left: 0.5em;
  }

  .wk :global(ul) {
    margin-top: 0;
  }

  .content :global(ol) {
    list-style-position: initial;
    margin: 0 0 0 1.25em;
  }
  .content :global(dd) {
    margin-left: 1em;
  }
</style>
