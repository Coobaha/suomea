import '@jxa/global-type';
import { run } from '@jxa/run';
// @ts-ignore
import * as alfy from 'alfy';
// @ts-ignore
import defaultBrowser from 'default-browser';
import * as convert from 'convert-layout/ru';
import type { default as MiniSearchT, SearchOptions } from 'minisearch';
import MiniSearch from 'minisearch';
import {
  WkSearchResult,
  SkSearchResultWithData,
} from 'server/src/shared/types';
import { upsertNoteLight } from './anki_actions';
import type { GoogleChrome } from './chrome';

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
  ];

  if (process.env.ANKI_BROWSER) {
    knownBrowsers.push(process.env.ANKI_BROWSER);
  }

  let browserName = 'Safari';
  let browserId = 'com.apple.Safari';

  await defaultBrowser()
    .then((browser: { name: string; id: string }) => {
      browserName = browser.name;
      browserId = browser.id;
    })
    .catch(() => {});

  const supported = knownBrowsers.includes(browserName);

  if (!supported && !process.env.ANKI_BROWSER) {
    alfy.error(`${browserName} is not supported, `);
    return;
  }

  if (process.env.ANKI_BROWSER && browserName !== process.env.ANKI_BROWSER) {
    browserName = process.env.ANKI_BROWSER;
    browserId = process.env.ANKI_BROWSER;
  }

  const isTranslate = href.startsWith('translate:');
  // replace translate in href
  if (isTranslate) {
    href = href.slice('translate:'.length);
  }

  const APP_BASE_URL = isTranslate
    ? 'https://translate.google.com/?sl=fi&tl=en&text='
    : `${process.env.FINNISH_URL || 'https://cooba.me/suomea'}/`.replace(
        /\/+$/,
        '/',
      );
  const tabUrl = isTranslate ? `https://translate.google.com` : APP_BASE_URL;
  return run<true>(
    (browserName, browserId, href, APP_BASE_URL, tabUrl) => {
      let browser: ReturnType<typeof Application> & GoogleChrome;
      try {
        browser = Application<GoogleChrome>(browserName);
      } catch (e) {
        browser = Application<GoogleChrome>(browserId);
      }

      browser.includeStandardAdditions = true;
      const success = browser
        .windows()
        .reverse()
        .some((window: any, _winIdx: number) => {
          const tabs = window.tabs();
          const tabIndex = tabs.findIndex((tab: GoogleChrome.Tab) =>
            tab.url().includes(tabUrl),
          );

          if (tabIndex > -1) {
            const ankiTab = tabs[tabIndex];
            ankiTab.url.set(`${APP_BASE_URL}${encodeURIComponent(href)}`);
            ankiTab.url.set(`${APP_BASE_URL}${encodeURIComponent(href)}`);
            window.activeTabIndex.set(tabIndex + 1);
            window.activeTabIndex.set(tabIndex + 1);
            return true;
          }
          return false;
        });
      if (!success) {
        browser.openLocation(`${APP_BASE_URL}${encodeURIComponent(href)}`);
      }
      browser.activate();
    },
    browserName,
    browserId,
    href,
    APP_BASE_URL,
    tabUrl,
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

type Data = {
  autocomplete: string;
  subtitle?: string;
  arg: string;
  title: string;
};

const search = async (term: string) => {
  const all: Data[] = [];

  const skToData = (data: SkSearchResultWithData[]) => {
    return data.map((element) => ({
      title: element.text,
      subtitle: element.data.sk_translation_strings?.join(', '),
      arg: element.text,
      autocomplete: element.text,
      order: 10 + element.translation_count,
    }));
  };

  const wkToData = (data: WkSearchResult) =>
    data.results.map((element) => ({
      title: element,
      subtitle: element,
      arg: element,
      order: 11,
    }));

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
  function wk() {
    return alfy
      .fetch(`${API_URL}/wk_search`, {
        query: {
          q: term,
        },
      })
      .then(wkToData)
      .then(handleNewData);
  }

  await Promise.all([wk(), sk('ru'), sk('fi'), sk('en')]);

  const titles = new Set<string>();
  all.map((x) => titles.add(x.title));
  const data = Array.from(titles).map((x) => ({ title: x, arg: x }));
  const constructor = MiniSearch as unknown as any;
  let miniSearch: MiniSearchT = new constructor({
    idField: 'arg',
    fields: ['title'], // fields to index for full-text search
    storeFields: ['title'],
    searchOptions: {
      fuzzy: true,
      prefix: true,
    },
    tokenize: (text) => {
      return text
        .replace(/ä/gim, 'a')
        .replace(/ÿ/gim, 'y')
        .replace(/ö/gim, 'o')
        .split(' ');
    },
  } as SearchOptions);
  miniSearch.addAll(data);

  let results = miniSearch
    .search(term)
    .sort((a, b) => b.score - a.score || b.title.localeCompare(a.title));

  if (results.length === 0) {
    alfy.output([
      {
        title: `open in Google Translate`,
        subtitle: term,
        arg: `translate:${term}`,
        autocomplete: term,
      },
      {
        title: `open in Browser`,
        subtitle: term,
        arg: `${term}`,
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
