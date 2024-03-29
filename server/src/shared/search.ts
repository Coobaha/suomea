import { load } from 'cheerio';
import createDOMPurify from 'dompurify';
import get from 'got';
import JSDom from 'jsdom';
import * as qs from 'querystring';

import * as NodeURL from 'node:url';
import logger from './logger.js';
import type { ImageT, SanakirjaData, WiktionaryData } from './types.js';

import JSON5 from 'json5';

const { window } = new JSDom.JSDOM(``);
const DOMPurify = createDOMPurify(window as unknown as Window);

const htmlAll = function ($$: cheerio.Root, el?: cheerio.Cheerio) {
  return el
    ?.toArray()
    .map((el) => {
      return $$(el).html();
    })
    .join('\n');
};
async function sk(opts: {
  term: string;
  lang: 'en' | 'ru' | 'fi';
  swap: boolean;
}) {
  let query = {
    q: opts.term,
    l: 17,
    l2: opts.lang === 'en' ? 3 : 22,
  };
  if (opts.swap) {
    const prev = query.l;
    query.l = query.l2;
    query.l2 = prev;
  }
  const search = qs.encode(query);
  const url = `https://www.sanakirja.org/search.php?${search}`;

  // console.time(`fetch_${url}`);
  const data = await get(url).text();
  // console.timeEnd(`fetch_${url}`);
  const $$ = load(DOMPurify.sanitize(data));
  const $html = $$.root();
  const translationLinks = $html.find('#translations tr > td:nth-child(2)');
  const translations = translationLinks
    .map((_i, el) => {
      const $el = $$(el);
      const text = $el.html();
      return opts.lang !== 'en' ? text?.split(/[{|(].*[}|)]/)[0] : text;
    })
    .toArray()
    .join('<br />');
  const translationsStrings = translationLinks.toArray().map((el) => {
    const $el = $$(el);
    const text = $el.text();

    return (
      (opts.lang !== 'en' ? text?.split(/[{|(].*[}|)]/)[0] : text)?.trim() ?? ''
    );
  });

  const synonyms = $html
    .find('.synonyms a')
    .map((_i, el) => {
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

interface Response {
  parse: Parse;
  error?: {
    code: 'missingtitle';
    info: string;
  };
}

interface Parse {
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

interface Category {
  sortkey: string;
  '*': string;
  hidden?: string;
}

interface Iwlink {
  prefix: string;
  url: string;
  '*': string;
}

interface Langlink {
  lang: string;
  url: string;
  langname: string;
  autonym: string;
  '*': string;
}

interface Link {
  ns: number;
  exists?: string;
  '*': string;
}

interface Section {
  toclevel: number;
  level: string;
  line: string;
  number: string;
  index: string;
  fromtitle: string;
  byteoffset: number;
  anchor: string;
}

interface Text {
  '*': string;
}

async function wiktionary(opts: {
  term: string;
}): Promise<WiktionaryData | null> {
  // Example query
  // https://en.wiktionary.org/w/api.php?action=parse&page=l%C3%A4mmet%C3%A4&format=json&converttitles=true&redirects=true
  const url = new NodeURL.URL('https://en.wiktionary.org/w/api.php');
  url.searchParams.append('action', 'parse');
  url.searchParams.append('format', 'json');
  url.searchParams.append('page', opts.term);
  url.searchParams.append('converttitles', 'true');
  url.searchParams.append('redirects', 'true');

  url.searchParams.append('prop', 'sections');
  const sections: Response = await get(url).json();
  if (sections.error) {
    const logged = {
      term: opts.term,
      code: sections.error?.code,
      info: sections.error?.info,
      message: 'Error fetching WK Sections',
    };
    logger.error(logged);
    throw Error('Error fetching WK sections ' + opts.term);
  }

  const finnishSection = sections.parse.sections.find((section) =>
    section.line.includes('Finnish'),
  );
  url.searchParams.delete('prop');
  if (finnishSection) {
    url.searchParams.append('section', finnishSection.index);
  }
  const body: Response = await get(url).json();

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

  if (!finnishSection) {
    const finnishLinks = body.parse.iwlinks
      .filter((link) => link.prefix === 'fi')
      .map((link) => {
        const linkTerm = DOMPurify.sanitize(link['*'].replace('fi:', ''));
        return `<div><a title="${linkTerm}" href="${DOMPurify.sanitize(
          link.url,
        ).replace('fi.', 'en.')}">${linkTerm}</a></div>`;
      })
      .join('\n');
    if (finnishLinks) {
      return {
        wk_translation: finnishLinks,
        Finnish: opts.term,
        meta: {},
      };
    }

    return null;
  }

  const html = body.parse.text['*'];
  const $$ = load(DOMPurify.sanitize(html));
  const $html = $$.root();
  $html.find('#toc').remove();
  $html.find('.mw-editsection').remove();
  $html.find('*').each((_x, el) => {
    const $el = $$(el);
    if ($el.attr('lang') !== 'fi') {
      $el.removeAttr('lang');
    }
    if ($el.hasClass('term-list-header')) {
      $el.removeClass('term-list-header').addClass('title');
    }
    if ($el.is('style')) {
      $el.remove();
    }
  });
  $html.find('table *').each((_x, el) => {
    $$(el).removeAttr('class').removeAttr('lang');
  });
  $html.find('a[href]').each((_i, el) => {
    const $el = $$(el);
    const href = $el.attr('href');

    const empty =
      $el.attr('href')?.includes('redlink=1') ||
      // $el.hasClass('new') ||
      $el.attr('title')?.includes('(page does not exist)');

    if (empty) {
      $el.removeAttr('href');
      $el.replaceWith(`<span>${$el.html()}</span>`);
      return;
    }

    if (!href) return;
    if (href?.startsWith('http://')) return;
    if (href?.startsWith('https://')) return;
    const absoluteHref = `https://en.wiktionary.org/${href?.replace(
      /^\/+/,
      '',
    )}`;
    $el.attr('href', absoluteHref);
  });

  const titles = $html.find('h1,h2,h3,h4,h5,h6');

  const allWordtypes = $html
    .find('.headword')
    .parent()
    .prev('h1,h2,h3,h4,h5,h6')
    .toArray()
    .map((el) => $$(el).text()?.toLowerCase());

  let wordtype = Array.from(new Set(allWordtypes));

  // fs.writeFileSync('wk.html', $html.html() ?? '');
  let maybeTranslation = $html
    .find('.Latn.headword[lang="fi"]')
    .closest('p')
    .next('ol, ul');

  maybeTranslation.find(':empty').remove();

  let translations: string;
  if (maybeTranslation.length) {
    translations = `<ol>${maybeTranslation
      .toArray()
      .map((el, i) => {
        const type = allWordtypes[i];
        let $ = $$(el);

        if (type && wordtype.length > 1 && maybeTranslation.length > 1) {
          return `<li>${type}<ol>${$.html()}</ol></li>`;
        }

        return $.html();
      })
      .join('\n')}</ol>`;
  } else {
    const plainTranslation = $html
      .find('.Latn.headword')
      .parent('p')
      .nextUntil('ol')
      .next('ol');
    plainTranslation.find(':empty').remove();
    translations = `<ol>${plainTranslation.html()}</ol>`;
  }

  const etymology = $html
    .find('.mw-headline:contains("Etymology")')
    .parent()
    .map((_i, el) => {
      const $el = $$(el).nextUntil(titles);
      return $el.html();
    })
    .toArray()
    .join(' ')
    .trim();

  const suffix = $html
    .find('.mw-headline:contains("Suffix")')
    .parent()
    .nextUntil(titles)
    .wrap('<div/>')
    .parent()
    .toArray()
    .map((el) => {
      const $el = $$(el);
      return $el.html();
    })
    .join('\n');

  let fiDecl = $html
    .find(
      '.mw-headline:contains("Declension"),.mw-headline:contains("Conjugation"),.mw-headline:contains("Inflection")',
    )
    .parent()
    .next('table');

  if (!fiDecl.length) {
    fiDecl = $html
      .find(
        '.mw-headline:contains("Declension"),.mw-headline:contains("Conjugation"),.mw-headline:contains("Inflection")',
      )
      .parent()
      .nextUntil('table')
      .next('table');
  }

  if (!fiDecl.length) {
    const head = $html.clone().find('.NavHead:contains("Conjugation")');
    fiDecl = head.parent();
    head.wrap(
      `<thead><tr><th colspan="6" style="padding:0;"></th></tr></thead>`,
    );
  }

  const isRealVerb =
    fiDecl.find('th').filter((_i, el) => {
      const $el = $$(el);
      const text = $el.text();
      return text.includes('present tense') || text.includes('perfect');
    }).length > 0;

  const possessive = htmlAll(
    $$,
    $html
      .find('a[title="Appendix:Finnish possessive suffixes"]')
      .closest('table')
      .first(),
  )
    ?.replace(/\n+/gm, '\n')
    ?.replace(/\n+</gm, '<');

  const kotus$ = fiDecl.find('a[title="Kotus"]').first();

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

  meta.syllabification = Array.from(
    new Set(
      $html
        .find('li:contains("Syllabification: ")')
        .children()
        .toArray()
        .map((el) => $$(el).text()),
    ),
  ).join(', ');

  const toComp = (el: cheerio.Element) => {
    const $el = $$(el);
    return {
      term: $el.text(),
      missing:
        ($el.attr('href')?.includes('redlink=1') ||
          $el.attr('title')?.includes('(page does not exist)')) ??
        false,
    };
  };

  let comparative = $html.find('.comparative-form-of').toArray().map(toComp);
  let superlative = $html.find('.superlative-form-of').toArray().map(toComp);

  if (!comparative.length) {
    comparative = $html
      .find('.Latn.headword')
      .next('*:contains("comparative")')
      .nextUntil('*:contains("superlative")')
      .find('a')
      .toArray()
      .map(toComp);
  }

  if (!superlative.length) {
    superlative = $html
      .find('.Latn.headword')
      .nextAll('*:contains("superlative")')
      .nextAll()
      .find('a')
      .toArray()
      .map(toComp);
  }

  if (comparative.length || superlative.length) {
    meta.adjective = {
      comparative,
      superlative,
    };
  }

  const decl = htmlAll($$, fiDecl)
    ?.replace(/\n+/gm, '\n')
    ?.replace(/\n+</gm, '<');

  const $derived = $html.find(
    'span:contains("Derived terms"), span:contains("Related terms")',
  );

  let derived = Array.from(
    new Set(
      $derived
        .parent()
        .map((_i, el) => {
          const $el = $$(el).nextUntil(titles);
          $el.find('*').removeAttr('style').removeAttr('class');
          $el.find('[data-hidetext]').remove();

          $el
            .find('table')
            .wrap('<div style="overflow-x: auto; max-width: 95vw"/>');
          let html = $el.html();

          if (html?.startsWith('<li')) {
            html = `<ul>${html}</ul>`;
          }
          return html;
        })
        .toArray(),
    ),
  )
    .join(' ')
    .replace('Derived terms', '')
    .trim();

  if (derived.startsWith('<li')) {
    derived = `<ul>${derived}</ul>`;
  }
  let $compounds = $html.find('.derivedterms');

  if ($compounds.length === 0) {
    $compounds = $html
      .find('span:contains("Compounds")')
      .parent()
      .nextUntil(titles);
  }

  $compounds.find('ul').css({
    display: 'grid',
    'grid-template-columns': 'repeat(4, 1fr)',
  });
  const compounds = $compounds.html();

  let synonyms = htmlAll(
    $$,
    $html.find('.mw-headline:contains("Synonyms")').parent().next('ul'),
  );
  let antonyms = htmlAll(
    $$,
    $html.find('.mw-headline:contains("Antonyms")').parent().next('ul'),
  );

  if (antonyms?.length === 0) {
    antonyms = `${$html
      .clone()
      .find('span.antonym')
      .toArray()
      .map((el) => {
        let $ = $$(el);
        const parent = $.closest('li');

        $.remove().find('span.defdate,span:contains("Antonym:")').remove();
        parent.find('span.synonym').remove();
        parent.find('.h-usage-example').remove();

        const meaning = parent.text();

        return `<li>(${meaning.trim().replace(/\n/gm, '')}): ${$.html()}</li>`;
      })
      .join('<br/>')}`;
  }

  if (synonyms?.length === 0) {
    synonyms = $html
      .clone()
      .find('span.synonym')
      .toArray()
      .map((el) => {
        let $ = $$(el);
        const parent = $.closest('li');

        $.remove().find('span.defdate,span:contains("Synonym:")').remove();
        parent.find('span.antonym').remove();
        parent.find('.h-usage-example').remove();

        const meaning = parent.text();

        return `<li>(${meaning.trim().replace(/\n/gm, '')}): ${$.html()}</li>`;
      })
      .join('<br/>');
  }

  const notes = htmlAll(
    $$,
    $html
      .find('#Usage_notes,#Usage_notes_2,#Usage_notes_1')
      .parent()
      .map((_i, el) => {
        const $el = $$(el).nextUntil(titles);
        $el.children().addClass('my-1');
        $el.find('.NavFrame .NavHead:contains("Conjugation")').parent().empty();

        return $el;
      }),
  );

  // console.timeEnd(url);

  return {
    wk_translation:
      suffix && !opts.term.startsWith('-')
        ? `${translations}\n<div class="subtitle is-6 my-2">Suffix</div>${suffix}`
        : translations,
    wk_notes: notes,
    wk_decl: decl,
    wk_synonyms: synonyms,
    wk_antonyms: antonyms,
    wk_derived: derived,
    etymology,
    wordtype: wordtype.join(', ').trim(),
    wk_possessive: possessive,
    compounds,
    suffix,
    meta,
    Finnish: opts.term,
  };
}

export const fetchWiktionary: (term: string) => Promise<WiktionaryData> = (
  term,
) =>
  wiktionary({
    term: term,
  }).then(
    (wk): WiktionaryData => ({
      Finnish: term,
      wk_url: `https://en.wiktionary.org/wiki/${term}#Finnish`,
      wk_translation: wk?.wk_translation,
      wk_synonyms: wk?.wk_synonyms,
      wk_antonyms: wk?.wk_antonyms,
      wk_decl: wk?.wk_decl,
      wk_notes: wk?.wk_notes,
      wk_derived: wk?.wk_derived,
      etymology: wk?.etymology,
      wordtype: wk?.wordtype,
      wk_possessive: wk?.wk_possessive,
      compounds: wk?.compounds,
      suffix: wk?.suffix,
      meta: wk?.meta ?? {},
    }),
  );

export const fetchSk: (
  term: string,
  lang: 'en' | 'ru' | 'fi',
  swap: boolean,
) => Promise<SanakirjaData> = (term: string, lang: 'en' | 'ru' | 'fi', swap) =>
  sk({
    term: term,
    lang,
    swap,
  }).then((sk) => ({
    Finnish: term,
    sk_url: sk.url,
    sk_translation: sk.translations,
    sk_synonyms: sk.synonyms,
    sk_translation_strings: sk.translationsStrings,
  }));

export const googleImages = async (search: string): Promise<ImageT[]> => {
  const url = `https://www.google.com/search?q=${encodeURIComponent(
    search,
  )}&tbm=isch&ie=UTF-8&cr=countryFI`;

  const data = await get({
    url,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    },
  }).text();

  const start = data.indexOf(`AF_initDataCallback({key: 'ds:1'`);
  const end = data.indexOf(`});`, start);
  const json = data.slice(start + 'AF_initDataCallback('.length, end + 1);

  const obj = JSON5.parse(json);

  const results = obj.data[56]?.[1]?.[0]?.[0]?.[1]?.[0] ?? [];

  const images: ImageT[] = [];
  for (const data of results.slice(0, 1)) {
    let values = Object.values(data?.[0]?.[0] ?? {}) as any;
    const arr1: unknown[] = values?.[0]?.[1] ?? [];
    const arr2: any = arr1?.[2];
    const meta: any = arr1[25] ?? { 2008: [null, search] };

    if (!arr2) {
      continue;
    }

    const items = {
      thumb_large: String(arr2[0]),
      height: Number(arr2[1]),
      width: Number(arr2[2]),
      name: String((meta['2008'] ?? [])[1] ?? 'not found'),
    };
    images.push(items);
  }
  return images;
};

export const myImages = async (search: string): Promise<ImageT[]> => {
  const url = `https://kuvapankki.papunet.net/api/search/all/${search}?jsonp`;

  return await get({
    url,
    timeout: {
      request: 10000,
    },
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
