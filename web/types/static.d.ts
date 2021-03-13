/* Use this file to declare any custom file extensions for importing */
/* Use this folder to also add/extend a package d.ts file, if needed. */

/* CSS MODULES */

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.module.sass' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.module.less' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.module.styl' {
  const classes: { [key: string]: string };
  export default classes;
}

/* CSS */
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
declare module '*.less';
declare module '*.styl';

/* IMAGES */
declare module '*.svg' {
  const ref: string;
  export default ref;
}
declare module '*.bmp' {
  const ref: string;
  export default ref;
}
declare module '*.gif' {
  const ref: string;
  export default ref;
}
declare module '*.jpg' {
  const ref: string;
  export default ref;
}
declare module '*.jpeg' {
  const ref: string;
  export default ref;
}
declare module '*.png' {
  const ref: string;
  export default ref;
}

declare module 'svelte-tags-input';
declare module '@spaceavocado/svelte-router' {
  // export * from '@spaceavocado/svelte-router/types/index';
  import {
    Router,
    RouterConfig,
  } from '@spaceavocado/svelte-router/types/router';
  import type { Readable } from 'svelte/store';
  import type { Route } from '@spaceavocado/svelte-router/types/route';

  declare const createRouter: (
    opts: RouterConfig,
  ) => Readable<
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
    SNOWPACK_PUBLIC_BASE_NAME?: string;
    SNOWPACK_PUBLIC_BASE?: string;
  };
}
