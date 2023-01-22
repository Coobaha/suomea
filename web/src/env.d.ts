declare module 'svelte-tags-input';
declare module '@spaceavocado/svelte-router' {
  // export * from '@spaceavocado/svelte-router/types/index';
  import {
    Router,
    RouterConfig,
  } from '@spaceavocado/svelte-router/types/router';
  import type { Readable } from 'svelte/store';
  import type { Route } from '@spaceavocado/svelte-router/types/route';

  declare const createRouter: (opts: RouterConfig) => Readable<
    Omit<Router, 'findRouteByName'> & {
      _history: History & { action: 'POP' | 'PUSH' | 'REPLACE' };
      findRouteByName: (
        name: string,
        routes: Router['routes'],
      ) => Route & {
        generator(
          params: Record<string, any>,
          opts?: { encode: boolean },
        ): string;
      };
    }
  >;
  /**
   * Create a router in read-only store.
   */
  export default createRouter;
  export declare let router: Router;
}
declare module '@spaceavocado/svelte-router/component/view';
declare module '@spaceavocado/svelte-router/component/link';

interface ImportMeta {
  readonly env: {
    readonly VITE_PUBLIC_BASE_NAME?: string;
    readonly VITE_PUBLIC_BASE?: string;
    readonly BASE_URL: string;
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
  };
}
