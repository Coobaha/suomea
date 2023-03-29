<svelte:options immutable="{true}" />

<script lang="ts">
  import RouterView from '@spaceavocado/svelte-router/component/view';
  import { ankiConnectURI, extraLanguage, updateSettings } from './ctx';
  import { get } from 'svelte/store';

  let modKey = '⌘';
  // svelte-ignore
  if (navigator.platform.indexOf('Win') > -1) {
    modKey = 'Ctrl';
  }

  let showRussian = get(extraLanguage) === 'ru';
  let ankiUri = get(ankiConnectURI);

  $: updateSettings((s) => ({
    ...s,
    extraLanguage: showRussian ? 'ru' : false,
    ankiConnectURI: ankiUri,
  }));

  function hideMe() {
    updateSettings((s) => ({ ...s, showAbout: false }));
  }
</script>

<div class="h-full min-h-full flex overflow-auto">
  <div class="flex min-h-full flex-col px-8 py-4 content">
    <h2 class="text-2xl font-medium mb-4">
      Learn how to efficiently search for Finnish, English, and Russian words
      using the powerful text box feature
    </h2>

    <ol class="mb-4 list list-decimal">
      <li class="text-gray-700">
        Open the app and navigate to the search bar located by clicking search
        icon
        <label
          for="mainInput-input"
          class="icon cursor-pointer inline"
          style="vertical-align: sub; line-height: 1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path
              d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
              stroke="currentColor"
              fill="none"></path>
          </svg>
        </label>
      </li>
      <li class="text-gray-700">
        Type in the Finnish, English, or Russian word you would like to search
        for in the text box.
      </li>
      <li class="text-gray-700">
        Press enter on your keyboard or click the search button to initiate the
        search.
      </li>
    </ol>

    <p class="mt-4">
      <button
        class="button is-outlined rounded mt-2"
        on:click="{hideMe}"
        style="vertical-align: baseline; display: inline-block;"
        >✅ Start learning
      </button>
    </p>

    <section class="message mt-auto">
      <div class="message-body">
        <h4 class="text-lg font-medium mb-2">Settings</h4>

        <div class="field" hidden>
          <label class="label is-small" for="ankiUri">Anki Connect URI</label>
          <div class="control ">
            <input
              id="ankiUri"
              class="input"
              type="text"
              placeholder="Text input"
              bind:value="{ankiUri}"
              pattern="https?://.+"
            />
          </div>
          <p class="help">
            For integration with <a
              target="_blank"
              rel="noreferrer"
              href="https://ankiweb.net/shared/info/2045459309">Anki Plugin</a
            >
          </p>
        </div>
        <div class="field mt-2">
          <label class="checkbox is-small">
            <input type="checkbox" bind:checked="{showRussian}" />
            Translate to Russian?
          </label>
        </div>
      </div>
    </section>
    <section class="message is-link ">
      <div class="message-body">
        <h3 class="text-lg font-medium mb-2 ">Power tips</h3>

        <ul class="list-disc ml-4 ">
          <li class="text-gray-800">
            Presssing <kbd>{modKey} K</kbd> or <kbd>.</kbd> or <kbd>/</kbd>will
            activate the search function, allowing you to quickly find the word
            you're looking for.
          </li>
          <li class="mt-2 text-gray-800">
            Double click on a title activates search too
          </li>
          <li class="mt-2 text-gray-800">
            This application can integrate with <img
              src="/anki.png"
              alt="anki"
              width="32px"
              height="32px"
              class="inline-block"
              style="margin-top:-6px; margin-right: -2px;"
            />
            Anki
          </li>
          <li class="mt-2 text-gray-800">
            It plays nice with <img
              src="/alfred.png"
              alt="alfred"
              width="28px"
              height="28px"
              class="inline-block"
              style="margin-top:-4px;"
            />
            Alfred or
            <img
              src="/raycast.png"
              alt="raycast"
              width="28px"
              height="28px"
              class="inline-block rounded"
              style="margin-top:-4px;"
            />
            Raycast
          </li>
        </ul>
        <p class="mt-4">
          Learn more
          <img
            src="/github.svg"
            alt="github"
            width="24px"
            height="24px"
            class="inline-block rounded"
            style="margin-top:-4px;"
          />
          <a
            href="https://github.com/Coobaha/suomea"
            target="_blank"
            rel="noreferrer">Coobaha/suomea</a
          >
        </p>
      </div>
    </section>
    <div class="mt-4 text-center lg:w-[70%]  mx-auto">
      <p class="text-gray-500">
        If you find this application useful, show your support by buying me a
        coffee. Your contribution will help keep this valuable resource going
        and allow for more development and improvement.
      </p>
      <a
        class="button rounded is-warning mb-4"
        rel="noreferrer"
        href="https://www.buymeacoffee.com/coobaha"
        target="_blank">☕ Buy me a coffee</a
      >
    </div>
  </div>
</div>

<RouterView />
