<svelte:options immutable="{true}" />

<script lang="ts">
  import { cardType, images, viewContext } from '../ctx';
  import { getUrl, Link } from '../router';

  let isQuestion: boolean;
  let isReversed: boolean;
  let isReversedQuestion: boolean;

  $: isQuestion = $viewContext.includes('Question');
  $: isReversed = $cardType === 'Reversed';

  $: isReversedQuestion = isReversed && isQuestion;
</script>

<article class="message is-info" class:hidden="{$images.length === 0}">
  <div class="message-header">Images</div>
  <div class="message-body p-3">
    <div
      class:opacity-5="{isQuestion && !isReversed}"
      class="is-flex is-flex-wrap-wrap is-justify-content-space-center"
    >
      {#each $images as image (image.thumb_large)}
        <div class="m-1 box p-2 image-box">
          <img
            class="image"
            src="{image.thumb_large}"
            height="80"
            width="80"
            alt=""
          />
          <Link
            to="{getUrl('main', { id: image.name })}"
            cls="tag is-flex mt-2 is-info is-light text"
          >
            <span class:invisible="{isReversedQuestion}">
              {image.name}
            </span>
          </Link>
        </div>
      {/each}
    </div>
  </div>
</article>

<style>
  .image-box {
    display: flex;
    flex-direction: column;
  }

  .image {
    width: auto;
    height: auto;
    max-width: 120px;
    max-height: 80px;
    margin: auto;
  }
</style>
