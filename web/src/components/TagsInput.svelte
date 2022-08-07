<!-- @hmr:keep-all -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let tag = '';
  let arrelementsmatch: { label: string; search: string }[] = [];
  let regExpEscape = (s: string) => {
    return s.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
  };
  export let tags: string[] = ['test'];
  export let autoComplete: string[] | null = null;
  export let addKeys: string[] = ['Enter'];
  export let tagClassname = '';
  export let removeKeys: string[] = ['Backspace'];
  export let maxTags: number = Infinity;
  export let placeholder: string = '';
  export let layoutReversed = false;
  export let allowPaste: boolean = false;
  export let allowDrop: boolean = false;
  export let splitWith: string = ',';
  export let name: string = 'svelte-tags-input';
  export let id: string = uniqueID();
  export let allowBlur: boolean = false;
  export let disable: boolean = false;
  export let hiddenInput: boolean = false;
  export let minChars: number = 1;

  let storePlaceholder = placeholder;
  let input: HTMLInputElement;
  let matches: HTMLUListElement | undefined;

  function setTag(event: KeyboardEvent) {
    const currentTag = input.value;

    if (addKeys) {
      addKeys.forEach(function (key) {
        if (key === event.key) {
          if (currentTag) event.preventDefault();

          switch (event.key) {
            case 'tab':
              if (matches) {
                addTag(matches?.querySelectorAll('li')[0]?.textContent ?? '');
              } else {
                addTag(currentTag);
              }
              break;
            default:
              addTag(currentTag);
              break;
          }
        }
      });
    }

    if (removeKeys) {
      removeKeys.forEach(function (key) {
        if (key === event.key && tag === '') {
          tags = [...tags];
          tags.pop();

          dispatch('tags', {
            tags: tags,
          });

          arrelementsmatch = [];
          input.readOnly = false;
          input.focus();
          placeholder = storePlaceholder;
        }
      });
    }

    // ArrowDown : focus on first element of the autocomplete
    if (event.key === 'ArrowDown' && autoComplete) {
      event.preventDefault();
      matches?.querySelector<HTMLInputElement>('li:first-child')?.focus();
    } // ArrowUp : focus on last element of the autocomplete
    else if (event.key === 'ArrowUp' && autoComplete) {
      event.preventDefault();
      matches?.querySelector<HTMLInputElement>('li:last-child')?.focus();
    }
  }

  function addTag(currentTag: string) {
    currentTag = currentTag.trim();

    if (currentTag == '') return;
    if (tags.length == maxTags) return;
    if (tags.includes(currentTag)) {
      tag = '';
      return;
    }

    tags = [...tags];
    tags.push(currentTag);

    tag = '';

    dispatch('tags', {
      tags: tags,
    });

    // Hide autocomplete list
    // Focus on svelte tags input
    arrelementsmatch = [];
    input.focus();

    if (tags.length == maxTags) {
      input.readOnly = true;
      placeholder = '';
    }
  }

  function removeTag(i: number) {
    tags = [...tags];
    tags.splice(i, 1);

    dispatch('tags', {
      tags: tags,
    });

    // Hide autocomplete list
    // Focus on svelte tags input
    arrelementsmatch = [];
    input.readOnly = false;
    placeholder = storePlaceholder;
    input.focus();
  }

  function onPaste(e: ClipboardEvent) {
    if (!allowPaste) return;

    e.preventDefault();

    const data = getClipboardData(e);
    splitTags(data).map((tag) => addTag(tag));
  }

  function onDrop(e: DragEvent) {
    if (!allowDrop) return;

    e.preventDefault();

    const data = e.dataTransfer?.getData('Text');
    if (data) {
      splitTags(data).map((tag) => addTag(tag));
    }
  }

  function onBlur(event: FocusEvent, tag: string) {
    if (!matches && allowBlur) {
      event.preventDefault();
      addTag(tag);
    }
  }

  function getClipboardData(event: ClipboardEvent) {
    if (event.clipboardData) {
      return event.clipboardData.getData('text/plain');
    }

    return '';
  }

  function splitTags(data: string) {
    return data.split(splitWith).map((tag) => tag.trim());
  }

  function getMatchElements(event: KeyboardEvent) {
    if (!autoComplete) return;

    const value = input.value;

    // Escape
    if (value == '' || event.key === 'Escape' || value.length < minChars) {
      arrelementsmatch = [];
      return;
    }

    arrelementsmatch = autoComplete
      .filter((e) => e.toLowerCase().includes(value.toLowerCase()))
      .filter((tag) => !tags.includes(tag))
      .map((matchTag) => {
        return {
          label: matchTag,
          search: matchTag.replace(
            RegExp(regExpEscape(value.toLowerCase()), 'i'),
            '<strong>$&</strong>',
          ),
        };
      });
  }

  function navigateAutoComplete(
    event: KeyboardEvent,
    autoCompleteIndex: number,
    autoCompleteLength: number,
    autoCompleteElement: string,
  ) {
    if (!autoComplete) return;

    event.preventDefault();

    if (event.key === 'ArrowDown') {
      // Last element on the list ? Go to the first
      if (autoCompleteIndex + 1 === autoCompleteLength) {
        matches?.querySelector<HTMLInputElement>('li:first-child')?.focus();
        return;
      }
      matches?.querySelectorAll('li')[autoCompleteIndex + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      // First element on the list ? Go to the last
      if (autoCompleteIndex === 0) {
        matches?.querySelector<HTMLInputElement>('li:last-child')?.focus();
        return;
      }
      matches?.querySelectorAll('li')[autoCompleteIndex - 1]?.focus();
    } else if (event.key === 'Enter') {
      addTag(autoCompleteElement);
    } else if (event.key === 'Escape') {
      arrelementsmatch = [];
      input.focus();
    }
  }

  function uniqueID() {
    return 'sti_' + Math.random().toString(36).slice(2, 9);
  }
</script>

<label
  for="{id}"
  class="flex items-center"
  class:sti-layout-disable="{disable}"
>
  <span class=" flex items-center">
    <span
      class="field contents is-small is-grouped is-grouped-multiline items-center mb-0 {layoutReversed
        ? 'flex-row-reverse'
        : ''}"
    >
      <span class="flex" style="margin-top: -0.325rem">
        <span class="contents">
          {#each tags as tag, i (tag)}
            <span class="control mr-1 my-1">
              <span class="tags has-addons">
                <span class="tag mb-1 {tagClassname}">{tag}</span>
                {#if !disable}
                  <span
                    class="tag mb-1 is-delete cursor-pointer {tagClassname}"
                    on:click="{() => removeTag(i)}"></span>
                {/if}
              </span>
            </span>
          {/each}
        </span>
      </span>
      {#if !hiddenInput}
        <span class="mb-0.5">
          <input
            type="text"
            id="{id}"
            name="{name}"
            bind:value="{tag}"
            bind:this="{input}"
            on:keydown="{setTag}"
            on:keyup="{getMatchElements}"
            on:paste="{onPaste}"
            on:drop="{onDrop}"
            on:blur="{(event) => onBlur(event, tag)}"
            class="input is-small inline-flex"
            placeholder="{placeholder}"
            disabled="{disable}"
          />
        </span>
      {/if}
    </span>
  </span>
</label>
{#if autoComplete && arrelementsmatch.length > 0}
  <div class="svelte-tags-input-matchs-parent">
    <ul bind:this="{matches}" class="svelte-tags-input-matchs">
      {#each arrelementsmatch as element, index}
        <li
          tabindex="-1"
          on:keydown="{(event) =>
            navigateAutoComplete(
              event,
              index,
              arrelementsmatch.length,
              element.label,
            )}"
          on:click="{() => addTag(element.label)}"
        >
          {@html element.search}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .input {
    border: 0;
    box-shadow: none;
  }
  .input:hover {
    box-shadow: 0 0 0 0.025em rgba(50, 50, 50, 0.25);
  }

  .input:focus,
  .input:active {
    border-color: #3273dc;
    box-shadow: 0 0 0 0.125em rgba(50, 115, 220, 0.25);
  }

  .svelte-tags-input-matchs {
    font-size: 14px;
    padding: 2px 5px;
  }
  .svelte-tags-input-matchs-parent {
    position: relative;
  }

  .svelte-tags-input-matchs {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    margin: 3px 0;
    padding: 0;
    background: #fff;
    border-radius: 2px;
    max-height: 310px;
    overflow: scroll;
    overflow-x: auto;
  }

  .svelte-tags-input-matchs li {
    list-style: none;
    padding: 5px;
    border-radius: 2px;
    cursor: pointer;
  }

  .svelte-tags-input-matchs li:hover,
  .svelte-tags-input-matchs li:focus {
    background: #000;
    color: #fff;
    outline: none;
  }

  /* svelte-tags-input disabled */
</style>
