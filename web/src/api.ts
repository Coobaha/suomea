import wretch from 'wretch';
import queryStringAddon from 'wretch/addons/queryString';
import abortAddon from 'wretch/addons/abort';
import { throttlingCache } from 'wretch-middlewares';
import type {
  ImageT,
  SanakirjaData,
  SkSearchResult,
  WiktionaryData,
  WkSearchResult,
} from './types';

import {
  upsertNoteLight,
  findExistingNotesId,
  findNotes,
} from './anki_actions';

const cache = throttlingCache({
  throttle: 1000 * 60 * 6,
});

const suomeaApi = wretch()
  .addon(abortAddon())
  .addon(queryStringAddon)
  .url('/api/suomea')
  .options({ credentials: 'include', mode: 'cors' })
  .middlewares([cache]);

export const fetchWk = (term: string, controller: AbortController) =>
  suomeaApi
    .url('/wk')
    .query({
      q: term,
    })
    .signal(controller)
    .get()
    .json<WiktionaryData>();

export const fetchSk = (
  term: string,
  lang: 'en' | 'ru',
  controller: AbortController,
) =>
  suomeaApi
    .url('/sk')
    .query({
      q: term,
      lang,
    })
    .signal(controller)
    .get()
    .json<SanakirjaData>();

export const fetchImages = (term: string, controller: AbortController) =>
  suomeaApi
    .url('/images')
    .query({
      q: term,
    })
    .signal(controller)
    .get()
    .setTimeout(10000, controller)
    .onAbort(() => [])
    .json<ImageT[]>();

export const searchSk = (
  text: string,
  lang: 'en' | 'ru' | 'fi',
  controller: AbortController,
) =>
  suomeaApi
    .url('/sk_search')
    .query({ q: text, lang })
    .signal(controller)
    .get()
    .json<SkSearchResult[]>();

export const searchWK = (text: string, controller: AbortController) =>
  suomeaApi
    .url('/wk_search')
    .query({ q: text })
    .signal(controller)
    .get()
    .json<WkSearchResult>();

export const saveTerm = (payload: {
  term: string;
  tags: string[];
  own_answer: string;
  meaning: string;
}) =>
  upsertNoteLight({
    meaning: payload.meaning,
    own_answer: payload.own_answer,
    tags: payload.tags,
    term: payload.term,
  });

function never(_: never) {}

export const ankiData = async (
  query: { term: string } | { id: number },
  controller: AbortController,
) => {
  async function fetchById(noteId: number) {
    const res = await findNotes([noteId], controller);

    if (res.tag === 'error') {
      throw new Error(res.error);
    }
    const [note] = res.result;
    if (!note) {
      throw new Error('Not found');
    }

    return note;
  }
  if ('id' in query) {
    return fetchById(query.id);
  } else if ('term' in query) {
    const [noteId] = await findExistingNotesId(query.term, controller);
    if (!noteId) throw new Error('Not found');
    return fetchById(noteId);
  } else {
    never(query);
  }
};
// ankiApi
//   .url('/anki_data')
//   .query(query)
//   .signal(controller)
//   .get()
//   .notFound(() => undefined)
//   .json<Note | undefined>();
