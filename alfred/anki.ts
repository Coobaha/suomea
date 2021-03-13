import '@jxa/global-type';
import { run } from '@jxa/run';
// @ts-ignore
import * as alfy from 'alfy';
// @ts-ignore
import defaultBrowser from 'default-browser';
import * as convert from 'convert-layout/ru';
import type { default as MiniSearchT, SearchOptions } from 'minisearch';
import MiniSearch from 'minisearch';
import { upsertNoteLight } from './anki_actions';
import { GoogleChrome } from './chrome';

const goTo = async (href: string) => {
  const knownBrowsers = [
    'Brave',
    'Safari',
    'Safari Technology Preview',
    'Google Chrome',
    'Google Chrome Canary',
    'Chromium',
    'Vivaldi',
    'Yandex',
    process.env.ANKI_BROWSER,
  ];

  let browserName = 'Safari';

  await defaultBrowser()
    .then((browser: { name: string; id: string }) => {
      browserName = browser.name;
    })
    .catch(() => {});

  const supported = knownBrowsers.includes(browserName);

  if (!supported && !process.env.ANKI_BROWSER) {
    alfy.error(`${browserName} is not supported, `);
    return;
  }

  if (process.env.ANKI_BROWSER && browserName !== process.env.ANKI_BROWSER) {
    browserName = process.env.ANKI_BROWSER;
  }

  return run<true>(
    (browserName, href, APP_BASE_URL) => {
      const browser = Application<GoogleChrome>(browserName);

      browser.includeStandardAdditions = true;
      const success = browser.windows().some((window: any, winIdx: number) => {
        const tabs = window.tabs();
        const tabIndex = tabs.findIndex((tab: GoogleChrome.Tab) =>
          tab.url().includes(APP_BASE_URL),
        );

        if (tabIndex > -1) {
          const ankiTab = tabs[tabIndex];
          ankiTab.url.set(`${APP_BASE_URL}/${encodeURIComponent(href)}`);
          window.activeTabIndex.set(tabIndex + 1);
          return true;
        }
        return false;
      });
      if (!success) {
        browser.openLocation(`${APP_BASE_URL}/${encodeURIComponent(href)}`);
      }
      browser.activate();
    },
    browserName,
    href,
    process.env.FINNISH_URL?.replace(/\/+$/, '') || 'https://cooba.me/suomea',
  );
};

const API_URL =
  process.env.FINNISH_API_URL?.replace(/\/+$/, '') ??
  'https://cooba.me/api/suomea';

const save = async (term: string) => {
  const meanings: string[] = [];

  function sk(lang: string) {
    return alfy
      .fetch(`${API_URL}/sk`, {
        query: {
          q: term,
          lang: lang,
        },
      })
      .then((data: { sk_translation_strings: string[] }) => {
        meanings.push(...data.sk_translation_strings);
      });
  }

  await Promise.all([sk('ru'), sk('en')]);

  return upsertNoteLight({
    term,
    tags: ['saved_by_alfred_workflow'],
    meaning: meanings.join('<br/><br/>'),
  }).catch((err: any) => {
    alfy.error(err);
  });
};
interface SkSearchResult {
  text: string;
  id: number;
  translation_count: number;
  data: {
    sk_translation_strings: string[];
  };
}
// type WkSearchResult = {
//   results: string[];
//   urls: string[];
// };
type Data = {
  autocomplete: string;
  subtitle: string;
  arg: string;
  title: string;
};
const search = async (term: string) => {
  const all: Data[] = [];

  const skToData = (data: SkSearchResult[]) => {
    return data.map((element) => ({
      title: element.text,
      subtitle: element.data.sk_translation_strings.join(', '),
      arg: element.text,
      order: 10 + element.translation_count,
    }));
  };

  // const wkToData = (data: WkSearchResult) =>
  //   data.results.map((element) => ({
  //     title: element,
  //     subtitle: element,
  //     arg: element,
  //     order: 11,
  //   }));

  const handleNewData = (data: Data[]) => {
    all.push(...data);
  };
  function sk(lang: string) {
    return alfy
      .fetch(`${API_URL}/sk_search_with_data`, {
        query: {
          q: term,
          lang: lang,
        },
      })
      .then(skToData)
      .then(handleNewData);
  }
  // function wk() {
  //   return alfy
  //     .fetch('${API_URL}/wk_search', {
  //       query: {
  //         q: term,
  //       },
  //     })
  //     .then(wkToData)
  //     .then(handleNewData);
  // }

  await Promise.all([
    sk('ru'),
    sk('fi'),
    sk('en') /*term.match(/^[а-я]/gim) ? sk("ru") : sk("en")*/,
  ]);

  const titles = new Set<string>();
  all.map((x) => titles.add(x.title));
  const data = Array.from(titles).map((x) => ({ title: x, arg: x }));
  const constructor = (MiniSearch as unknown) as any;
  let miniSearch: MiniSearchT = new constructor({
    idField: 'arg',
    fields: ['title'], // fields to index for full-text search
    storeFields: ['title'],
    searchOptions: {
      fuzzy: true,
      prefix: true,
    },
    tokenize: (text) => {
      return text.split(' ');
    },
  } as SearchOptions);
  miniSearch.addAll(data);

  let results = miniSearch
    .search(term)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  if (results.length === 0) {
    alfy.output([
      {
        title: term,
        subtitle: `No results found - click to open in browser`,
        arg: term,
        autocomplete: term,
      },
    ]);
  } else {
    alfy.output(
      results
        .map((x) => ({
          title: `${x.title}`,
          subtitle: all
            .filter((y) => y.title === x.title)
            .map((x) => x.subtitle)
            .join(', '),
          arg: x.title,
          autocomplete: x.title,
        }))
        .concat([
          {
            title: `Open ${term} in browser`,
            subtitle: '',
            arg: term,
            autocomplete: term,
          },
        ]),
    );
  }
};
const [, , cmd, ...queryArgs] = process.argv;
let query = queryArgs.join(' ');
if (query.startsWith('.') || query.startsWith(',') || query.startsWith('/')) {
  query = convert.fromEn(query.slice(1));
}
query = query
  .trim()
  .replace(/ä/gim, 'ä')
  .replace(/ÿ/gim, 'ÿ')
  .replace(/ö/gim, 'ö');

if (query) {
  switch (cmd) {
    case 'search':
      search(query);
      break;
    case 'open':
      goTo(query);
      break;
    case 'save':
      save(query);
      break;
    default:
      throw Error('Unknown cmd');
  }
}
