import { get } from 'svelte/store';
import wretch from 'wretch';
import { throttlingCache } from 'wretch-middlewares';
import { ankiConnectURI, isAnki } from './ctx';
import type { AnkiPluginConfig, Data, Note } from './types';
import { Deferred } from './utils/deferred';

const cache = throttlingCache({
  throttle: 1000 * 60 * 2,
  key: (url, opts) => opts.cacheKey || url,
  skip: (url, opts) => {
    try {
      if (!get(isAnki)) {
        return true;
      }

    } catch (e) {}
    if (opts.forceCache) {
      return false;
    }
    return opts.skipCache || opts.method !== 'GET';
  },
});

const ankiApi = wretch()
  .defer((w) => {
    const url = get(ankiConnectURI);
    return w.url(url);
  })
  .middlewares([cache]);

const options = (settings: AnkiPluginConfig) => ({
  allowDuplicate: false,
  duplicateScope: settings.question_field,
  duplicateScopeOptions: {
    deckName: settings.deck,
    checkChildren: false,
  },
});

type Result<T> =
  | { tag: 'ok'; result: T }
  | { tag: 'error'; error: any; res: any };
type ResultP<T> = Promise<Result<T>>;

const apiResponseToResult = (res: any): Result<any> =>
  res.error != undefined
    ? { tag: 'error' as const, error: res.error, res }
    : { tag: 'ok' as const, result: res.result };

function getFields(settings: AnkiPluginConfig, fields: Data) {
  return {
    [String(settings.question_field)]: settings.question_field
      ? fields.Finnish
      : undefined,
    [String(settings.answer_field)]: settings.answer_field
      ? fields.meaning ?? undefined
      : undefined,
    [String(settings.notes_field)]: settings.notes_field
      ? fields.own_answer ?? undefined
      : undefined,
  };
}

let lastSettingsCall = new Deferred<AnkiPluginConfig>();

export const isConnected = (
  ctrl: AbortController,
): Promise<AnkiPluginConfig | { error: string }> => {
  if (lastSettingsCall.state !== 'pending') {
    lastSettingsCall = new Deferred();
  }
  return ankiApi
    .signal(ctrl)
    .post({
      action: 'coobame_settings',
    })
    .json<AnkiPluginConfig>()
    .then(lastSettingsCall.resolve)
    .catch((e) => {
      console.error(e);
      return lastSettingsCall.resolve({
        enabled: false,
      });
    });
};

const canAddNote = async (Finnish: string): Promise<boolean> => {
  const settings = await lastSettingsCall;
  return ankiApi

    .post({
      action: 'canAddNotes',
      version: 6,
      params: {
        notes: [
          {
            deckName: settings.deck,
            modelName: settings.note_type,
            fields: getFields(settings, { Finnish, meta: {} }),
            options: options,
          },
        ],
      },
    })
    .json()
    .then((res: any) => {
      if (res.error) {
        console.error(
          'actions#canAddNote error for %s message: %j',
          Finnish,
          res.error,
        );
        return false;
      } else {
        console.info(
          'actions#canAddNote result for %s res: %j',
          Finnish,
          res.result,
        );
        return res.result[0] === true;
      }
    });
};

const createNewNote = async (fields: Data, tags: string[]) => {
  const settings = await lastSettingsCall;

  return ankiApi
    .post({
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: settings.deck,
          modelName: settings.note_type,
          fields: getFields(settings, fields),
          tags: tags,
          options: options,
        },
      },
    })
    .json()
    .then((res: any) => {
      if (res.error) {
        console.error(
          'Node creation error for %s message: %j',
          fields.Finnish,
          res.error,
        );
        throw Error('Error happened ' + res.error);
      } else {
        console.info('Note was created %s id %d', fields.Finnish, res.result);
      }
    });
};

const updateTags = async (
  existingNote: number,
  tags: string[],
  fields: Data,
) => {
  return ankiApi
    .post({
      action: 'addTags',
      version: 6,
      params: {
        notes: [existingNote],
        tags: tags.join(' '),
      },
    })
    .json()
    .then((res: any) => {
      if (res.error) {
        console.error(
          'Node updating tags error for %s message: %j tags: %j',
          fields.Finnish,
          res.error,
          tags,
        );
        throw Error('Error happened ' + res.error);
      } else {
        console.info(
          'Note tags updated %s [%d] with %j',
          fields.Finnish,
          existingNote,
          tags,
        );
      }
    });
};

const updateNote = async (existingNote: number, fields: Data) => {
  const settings = await lastSettingsCall;

  return ankiApi
    .post({
      action: 'updateNoteFields',
      version: 6,
      params: {
        note: {
          id: existingNote,
          fields: getFields(settings, fields),
          options: options,
        },
      },
    })
    .json()
    .then((res: any) => {
      if (res.error) {
        console.error(
          'Node updating error for %s message: %j',
          fields.Finnish,
          res.error,
        );
        throw Error('Error happened ' + res.error);
      } else {
        console.info('Note was updated %s [%d]', fields.Finnish, existingNote);
      }
    });
};

export async function findExistingNotesId(
  term: string,
  controller: AbortController,
): Promise<number[]> {
  const settings = await lastSettingsCall;
  const search = `deck:"${settings.deck}" ${settings.question_field}:"${term}" card:1 nc:`;
  return await ankiApi
    .signal(controller)
    .options({ forceCache: true, cacheKey: `findNotes_${search}` })
    .post({
      action: 'findNotes',
      version: 6,
      params: {
        query: search,
      },
    })
    .json()
    .then((res: any) => {
      if (res.error) {
        console.error(
          'actions#findNotes error for %s message: %j, search: %s',
          term,
          res.error,
          search,
        );
        throw Error('Error happened');
      } else {
        console.info('actions#findNotes found %s ids %j', term, res.result);
        if (res.result.length > 1) {
          console.warn('actions#findNotes found %s ids %j', term, res.result);
        }

        return res.result;
      }
    });
}

const updateExistingNote = async (fields: Data, tags: string[]) => {
  const [firstNote] = await findExistingNotesId(
    fields.Finnish,
    new AbortController(),
  );

  if (!firstNote) {
    throw Error('Note not found');
  }
  const tasks = [firstNote].flatMap((existingNote) => [
    updateNote(existingNote, fields),
    updateTags(existingNote, tags, fields),
  ]);
  return Promise.all(tasks);
};

export const upsertNoteLight = async ({
  meaning,
  own_answer,
  tags,
  term,
}: {
  term: string;
  tags: string[];
  meaning: string;
  own_answer: string;
}) => {
  const shouldCreateNewNote = await canAddNote(term);

  const fieldsLike: Data = {
    meta: {},
    Finnish: term,
    own_answer,
    meaning: meaning
      .replace(/<[^>]*(>|$)|&nbsp;|&zwnj;|&raquo;|&laquo;|&gt;/g, ', ')
      .split(/, /gim)
      .map((x) => x.trim())
      .filter(Boolean)
      .join(', ')
      .replace(/MYNEWLINE_SEP, /gim, 'MYNEWLINE_SEP')
      .replace(/, ,/gim, '')
      .replace(/MYNEWLINE_SEP/gim, '<br/><br/>'),
  };

  if (shouldCreateNewNote) {
    console.info('Creating new note %s', term);
    await createNewNote(fieldsLike, tags);
  } else {
    console.info('Updating existing note %s', term);
    await updateExistingNote(fieldsLike, tags);
  }
};

export const findNotes = (
  notes: number[],
  controller: AbortController = new AbortController(),
): ResultP<Note[]> =>
  ankiApi
    .signal(controller)
    .options({ forceCache: true, cacheKey: `notesInfo_${notes.join(',')}` })
    .post({
      action: 'notesInfo',
      version: 6,
      params: {
        notes,
      },
    })
    .json()
    .then(apiResponseToResult);
