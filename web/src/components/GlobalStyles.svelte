<script lang="ts">
  import 'bulma/css/bulma.min.css';
</script>

<svelte:options immutable="{true}" />

<style global lang="postcss">
  /* only apply purgecss on utilities, per Tailwind docs */
  /* purgecss start ignore */
  @tailwind base;
  @tailwind components;
  /* purgecss end ignore */

  @tailwind utilities;
  [hidden] {
    display: none;
  }

  html,body {
    height: 100%;
  }
</style>
