import Router from '@spaceavocado/svelte-router';
import link from '@spaceavocado/svelte-router/component/link';
import { get } from 'svelte/store';
import type { RouterConfig } from '@spaceavocado/svelte-router/types/router';
type pages = ['main', { id: string }];

const opts: RouterConfig = {
  routes: [
    {
      name: 'main',
      path: '/:id',
      component: import('./MainView.svelte'),
      props: true,
    },
    {
      name: 'mainNoSearch',
      path: '*',
      component: import('./MainView.svelte'),
      props: () => {
        return {
          id: '',
        };
      },
    },
  ],
};

const parts = location.pathname.split('/');

if (parts.length > 2) {
  opts.basename = parts[1];
}

const router = get(Router(opts));

export const Link = link;
export const getHistory = () => router._history;
export const getUrl = (name: pages[0], params: pages[1]) => {
  const route = router.findRouteByName(name, router.routes);
  return `${router.basename}${route.generator(params)}`;
};
export const push = (name: pages[0], params: pages[1]) => {
  const url = getUrl(name, params);
  requestAnimationFrame(() => {
    router.push(url);
  });
};
export const pushUrl = (url: string) => {
  router.push(url);
};
{
  const prev = history.pushState;
  history.pushState = (data: any, title: string, url?: string | null) => {
    // history.state.lastScroll = {
    //   x: window.scrollX,
    //   y: window.scrollY,
    // };
    // history.replaceState(history.state, document.title);
    prev.call(history, data, title, url);
    window.scrollTo(0, 0);
  };

  // const prevBack = history.back;
  // history.back = () => {
  //   // history.пуе.lastScroll = {
  //   //   x: window.scrollX,
  //   //   y: window.scrollY,
  //   // };
  //   // history.replaceState(history.state, document.title);
  //   prevBack();
  // };
  window.onpopstate = function (event: PopStateEvent) {
    if (event?.state?.lastScroll) {
      setTimeout(() => {
        window.scrollTo(event.state.lastScroll.x, event.state.lastScroll.y);
      }, 33);
    }
  };
}
