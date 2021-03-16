import $$ from 'cheerio';

import NodeURL from 'url';
import get from 'got';
import qs from 'querystring';
import createDOMPurify from 'dompurify';
import JSDom from 'jsdom';
import { Data, ImageT, SanakirjaData, WiktionaryData } from './types';
import logger from './logger';

const JSON5 = require('json5');
const { window } = new JSDom.JSDOM(``);
const DOMPurify = createDOMPurify(window);

async function sk(opts: { term: string; lang: 'en' | 'ru' | 'fi' }) {
  const search = qs.encode({
    q: opts.term,
    l: 17,
    l2: opts.lang === 'en' ? 3 : 22,
  });
  const url = `https://www.sanakirja.org/search.php?${search}`;
  // console.time(url);
  // console.time(`fetch_${url}`);
  const data = await get(url).text();
  // console.timeEnd(`fetch_${url}`);
  const $html = $$.load(DOMPurify.sanitize(data)).root();

  const translationLinks = $html.find('#translations tr > td:nth-child(2)');
  const translations = translationLinks
    .map((i, el) => {
      const $el = $$(el);
      const text = $el.html();
      return opts.lang !== 'en' ? text?.split(/[{|(].*[}|)]/)[0] : text;
    })
    .toArray()
    .join('<br />');
  const translationsStrings = translationLinks.toArray().map((el) => {
    const $el = $$(el);
    const text = $el.text();

    return (opts.lang !== 'en' ? text?.split(/[{|(].*[}|)]/)[0] : text).trim();
  });

  const synonyms = $html
    .find('.synonyms a')
    .map((i, el) => {
      const $el = $$(el);
      const text = $el.html();
      return text;
    })
    .toArray()
    .join('<br />');
  // console.timeEnd(url);

  return {
    url,
    translations,
    translationsStrings,
    synonyms,
  };
}

export interface Response {
  parse: Parse;
  error?: {
    code: 'missingtitle';
    info: string;
  };
}

export interface Parse {
  title: string;
  pageid: number;
  revid: number;
  text: Text;
  langlinks: Langlink[];
  categories: Category[];
  links: Link[];
  templates: Link[];
  images: any[];
  externallinks: string[];
  sections: Section[];
  parsewarnings: any[];
  displaytitle: string;
  iwlinks: Iwlink[];
  properties: any[];
}

export interface Category {
  sortkey: string;
  '*': string;
  hidden?: string;
}

export interface Iwlink {
  prefix: string;
  url: string;
  '*': string;
}

export interface Langlink {
  lang: string;
  url: string;
  langname: string;
  autonym: string;
  '*': string;
}

export interface Link {
  ns: number;
  exists?: string;
  '*': string;
}

export interface Section {
  toclevel: number;
  level: string;
  line: string;
  number: string;
  index: string;
  fromtitle: string;
  byteoffset: number;
  anchor: string;
}

export interface Text {
  '*': string;
}

async function wiktionary(opts: { term: string }) {
  // Example query
  // https://en.wiktionary.org/w/api.php?action=query&prop=extracts&titles=pomology&format=json
  const url = NodeURL.format({
    protocol: 'https',
    hostname: `en.wiktionary.org`,
    pathname: '/w/api.php',
    query: {
      action: 'parse',
      format: 'json',
      page: opts.term,
      converttitles: true,
      redirects: true,
    },
  });
  // console.time(url);
  // console.time(`fetch_${url}`);
  const body: Response = await get(url).json();
  // console.timeEnd(`fetch_${url}`);

  if (body.error) {
    const logged = {
      term: opts.term,
      code: body.error?.code,
      info: body.error?.info,
      message: 'Error fetching WK term',
    };
    logger.error(logged);
    throw Error('Error fetching WK term ' + opts.term);
  }
  const html = body.parse.text['*'];

  const finnish = html
    .split('<hr />')
    .find((section) =>
      section.includes('<span class="mw-headline" id="Finnish">Finnish</span>'),
    );

  if (!finnish) return null;

  const $html = $$.load(DOMPurify.sanitize(finnish)).root();

  $html.find('.mw-editsection').remove();
  $html.find('*').each((x, el) => {
    const $el = $$(el);
    $el.removeAttr('lang');
    if ($el.hasClass('term-list-header')) {
      $el.removeClass('term-list-header').addClass('title');
    }
    if ($el.is('style')) {
      $el.remove();
    }
  });
  $html.find('table *').each((x, el) => {
    $$(el).removeAttr('class').removeAttr('lang');
  });
  $html.find('a[href]').each((i, el) => {
    const $el = $$(el);
    const href = $el.attr('href');
    if (!href) return;
    if (href?.startsWith('http://')) return;
    if (href?.startsWith('https://')) return;
    const absoluteHref = `https://en.wiktionary.org/${href?.replace(
      /^\/+/,
      '',
    )}`;
    $el.attr('href', absoluteHref);
  });

  let wordtype = Array.from(
    new Set(
      $html
        .find('.headword')
        .parent()
        .prev('h1, h2, h3, h4, h5, h6')
        .toArray()
        .map((el) => $$(el).text()?.toLowerCase()),
    ),
  );

  const maybeTranslation = $html.find('.Latn.headword').parent().next('ol');
  const translations = `<ol>${
    maybeTranslation.length
      ? maybeTranslation.html()
      : $html.find('.Latn.headword').parent().nextUntil('ol').next('ol').html()
  }</ol>`;

  const notes = $html
    .find('#Usage_notes,#Usage_notes_2,#Usage_notes_1')
    .parent()
    .nextUntil('h1, h2, h3, h4, h5, h6')
    .html();

  const etymology = $html
    .find('.mw-headline:contains("Etymology")')
    .parent()
    .nextUntil('h1, h2, h3, h4, h5, h6')
    .html();

  const suffix = $html
    .find('.mw-headline:contains("Suffix")')
    .parent()
    .nextUntil('h1, h2, h3, h4, h5, h6')
    .html();

  let fiDecl = $html
    .find(
      '.mw-headline:contains("Declension"),.mw-headline:contains("Conjugation")',
    )
    .parent()
    .next('table');

  if (!fiDecl.length) {
    fiDecl = $html
      .find(
        '.mw-headline:contains("Declension"),.mw-headline:contains("Conjugation")',
      )
      .parent()
      .nextUntil('table')
      .next('table');
  }

  const isRealVerb =
    fiDecl.find('th').filter((i, el) => {
      const $el = $$(el);
      const text = $el.text();
      return text.includes('present tense') || text.includes('perfect');
    }).length > 0;

  const possessive = $html
    .find('a[title="Appendix:Finnish possessive suffixes"]')
    .closest('table')
    .first()
    .html()
    ?.replace(/\n+/gm, '\n')
    ?.replace(/\n+</gm, '<');

  const kotus$ = $html.find('a[title="Kotus"]').first();
  const kotus = kotus$[0];

  if (!isRealVerb && wordtype.includes('verb')) {
    wordtype = wordtype.filter((x) => x !== 'verb');
  }

  let meta: WiktionaryData['meta'] = {};
  if (kotus && kotus.type === 'tag') {
    const kotusType = parseInt(
      kotus.nextSibling.data?.replace(/[^0-9]/gim, '') || '',
    );
    const word = kotus$.next().text();
    const gradation = kotus$.nextAll('i').text();

    meta = {
      kotus: kotusType,
      kotus_word: word,
      gradation,
    };
    if (wordtype.includes('verb') && isRealVerb) {
      let type;
      {
        const term = opts.term;
        const typ2 = ['da', 'dä'].includes(term.slice(-2));
        const typ3 =
          ['la', 'lä', 'na', 'nä', 'ra', 'rä'].includes(term.slice(-2)) ||
          ['sta', 'stä'].includes(term.slice(-3));
        const typ4 = ['ta', 'tä'].includes(term.slice(-2));
        const typ5 =
          !['levitä'].includes(term) && ['ita', 'itä'].includes(term.slice(-3));
        const typ6 =
          !['kiivetä'].includes(term) &&
          ['eta', 'etä'].includes(term.slice(-3));
        type = typ6 ? 6 : typ5 ? 5 : typ2 ? 2 : typ3 ? 3 : typ4 ? 4 : 1;
      }
      meta.verb = {
        type,
      };
    }
  }

  const decl = fiDecl?.html()?.replace(/\n+/gm, '\n')?.replace(/\n+</gm, '<');
  const synonyms = $html
    .find('.mw-headline:contains("Synonyms")')
    .parent()
    .next('ul')
    .html();

  const antonyms = $html
    .find('.mw-headline:contains("Antonyms")')
    .parent()
    .next('ul')
    .html();
  const $derived = $html.find('span:contains("Derived terms")');

  let derived = $derived
    .parent()
    .nextUntil('h1, h2, h3, h4, h5, h6')
    .map((i, el) => {
      const $el = $$(el);
      $el.find('*').removeAttr('style').removeAttr('class');
      const text = $el.html();
      return text?.startsWith('<')
        ? text
        : `<div class="subtitle">${text}</div>`;
    })
    .toArray()
    .join(' ')
    .trim();

  if (derived.startsWith('<li')) {
    derived = `<ul>${derived}</ul>`;
  }
  const $compounds = $html.find('.derivedterms');

  $compounds.find('ul').css({
    display: 'grid',
    'grid-template-columns': 'repeat(4, 1fr)',
  });
  const compounds = $compounds.html();
  // console.timeEnd(url);
  return {
    translations: suffix
      ? `${translations}\n<div class="subtitle is-6 my-2">Suffix</div>${suffix}`
      : translations,
    notes,
    decl,
    synonyms,
    antonyms,
    derived,
    etymology,
    wordtype: wordtype.join(', ').trim(),
    possessive,
    compounds,
    suffix,
    meta,
  };
}

const fetch: (term: string) => Promise<Data> = (term: string) =>
  Promise.all([
    sk({
      term: term,
      lang: 'en',
    }),
    sk({
      term: term,
      lang: 'ru',
    }),
    wiktionary({
      term: term,
    }),
  ]).then(([en, ru, wk]) => ({
    Finnish: term,
    sk_en_url: en.url,
    sk_ru_url: ru.url,
    wk_url: `https://en.wiktionary.org/wiki/${term}#Finnish`,
    en_translation: en.translations,
    en_synonyms: en.synonyms,

    ru_translation: ru.translations,
    ru_synonyms: ru.synonyms,
    wk_translation: wk?.translations,
    wk_synonyms: wk?.synonyms,
    wk_antonyms: wk?.antonyms,
    wk_decl: wk?.decl,
    wk_notes: wk?.notes,
    wk_derived: wk?.derived,
    etymology: wk?.etymology,
    suffix: wk?.suffix,
    wordtype: wk?.wordtype,
    wk_possessive: wk?.possessive,
    compounds: wk?.compounds,
    meta: wk?.meta ?? {},
  }));

export const fetchWiktionary: (term: string) => Promise<WiktionaryData> = (
  term,
) =>
  wiktionary({
    term: term,
  }).then((wk) => ({
    Finnish: term,
    wk_url: `https://en.wiktionary.org/wiki/${term}#Finnish`,
    wk_translation: wk?.translations,
    wk_synonyms: wk?.synonyms,
    wk_antonyms: wk?.antonyms,
    wk_decl: wk?.decl,
    wk_notes: wk?.notes,
    wk_derived: wk?.derived,
    etymology: wk?.etymology,
    wordtype: wk?.wordtype,
    wk_possessive: wk?.possessive,
    compounds: wk?.compounds,
    suffix: wk?.suffix,
    meta: wk?.meta ?? {},
  }));

export const fetchSk: (
  term: string,
  lang: 'en' | 'ru' | 'fi',
) => Promise<SanakirjaData> = (term: string, lang: 'en' | 'ru' | 'fi') =>
  sk({
    term: term,
    lang,
  }).then((sk) => ({
    Finnish: term,
    sk_url: sk.url,
    sk_translation: sk.translations,
    sk_synonyms: sk.synonyms,
    sk_translation_strings: sk.translationsStrings,
  }));

export default fetch;

export const googleImages = async (search: string): Promise<ImageT[]> => {
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    search,
  )}&tbm=isch&ie=UTF-8&cr=countryFI`;

  const data = await get({
    url,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' +
        '(KHTML, like Gecko) Chrome/73.0.3683.103 Whale/1.5.72.4 Safari/537.36',
    },
  }).text();

  const start = data.indexOf(`AF_initDataCallback({key: 'ds:1'`);
  const end = data.indexOf(`});`, start);
  const json = data.slice(start + 'AF_initDataCallback('.length, end + 1);
  const obj = JSON5.parse(json);
  const results = obj.data[31][0][12][2];

  const images: ImageT[] = [];
  for (const data of results) {
    const arr1 = data[1] ?? [];
    const arr2 = arr1[3];
    const meta = arr1[9] ?? { 2008: [null, search] };

    if (!arr2) {
      continue;
    }

    images.push({
      thumb_large: arr2[0],
      height: arr2[1],
      width: arr2[2],
      name: (meta['2008'] ?? [])[1] ?? 'not found',
    });
  }
  return images;
};

export const myImages = async (search: string): Promise<ImageT[]> => {
  const url = `https://kuvapankki.papunet.net/api/search/all/${search}?jsonp`;

  return await get({
    url,
    timeout: 10000,
  })
    .text()
    .then((res) => res.substring(1))
    .then((res) => res.substring(0, res.length - 2))
    .then((res) => JSON.parse(res))
    .then((res) => {
      return res.images || [];
    })
    .catch((e) => {
      console.log(e);
      return [];
    });
};
