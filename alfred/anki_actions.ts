// @ts-ignore
import * as alfy from 'alfy';

type Data = {
  Finnish: string;
  meaning?: string;
  own_answer?: string;
};
type AnkiPluginConfig = {
  enabled: boolean;
  note_type?: string;
  deck?: string;
  question_field?: string;
  notes_field?: string;
  answer_field?: string;
};

const ankiConnectURI =
  process.env['ANKI_CONNECT_URI'] || 'http://localhost:8765';

let settings: AnkiPluginConfig = { enabled: false };

const options = () => ({
  allowDuplicate: false,
  duplicateScope: settings.question_field,
  duplicateScopeOptions: {
    deckName: settings.deck,
    checkChildren: false,
  },
});

function getFields(fields: Data) {
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

const updateSettings = (): Promise<void> =>
  alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'coobame_settings',
      },
    })
    .then((s: AnkiPluginConfig) => {
      console.error(s);
      settings = s;
    })
    .catch((e: any) => {
      alfy.log(e);
      settings = {
        enabled: false,
      };
      return;
    });

const canAddNote = (Finnish: string): Promise<boolean> =>
  alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'canAddNotes',
        version: 6,
        params: {
          notes: [
            {
              deckName: settings.deck,
              modelName: settings.note_type,
              fields: getFields({ Finnish }),
              options: options,
            },
          ],
        },
      },
    })
    .then((res: any) => {
      if (res.error) {
        console.error(
          'actions#canAddNote error for %s message: %j',
          Finnish,
          res.error,
        );
        return false;
      } else {
        console.error(
          'actions#canAddNote result for %s res: %j',
          Finnish,
          res.result,
        );
        return res.result[0] === true;
      }
    });

const createNewNote = (fields: Data, tags: string[]) =>
  alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'addNote',
        version: 6,
        params: {
          note: {
            deckName: settings.deck,
            modelName: settings.note_type,
            fields: getFields(fields),
            tags: tags,
            options: options,
          },
        },
      },
    })

    .then((res: any) => {
      if (res.error) {
        console.error(
          'Note creation error for %s message: %j',
          fields.Finnish,
          res.error,
        );
        throw Error('Error happened ' + res.error);
      } else {
        console.info('Note was created %s id %d', fields.Finnish, res.result);
      }
    });

const updateTags = (existingNote: number, tags: string[], fields: Data) =>
  alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'addTags',
        version: 6,
        params: {
          notes: [existingNote],
          tags: tags.join(' '),
        },
      },
    })

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
        console.error(
          'Note tags updated %s [%d] with %j',
          fields.Finnish,
          existingNote,
          tags,
        );
      }
    });

const updateNote = (existingNote: number, fields: Data) =>
  alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'updateNoteFields',
        version: 6,
        params: {
          note: {
            id: existingNote,
            fields: getFields(fields),
            options: options,
          },
        },
      },
    })

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

async function findExistingNotesId(term: string): Promise<number[]> {
  const search = `deck:"${settings.deck}" ${settings.question_field}:"${term}" card:1 nc:`;
  return await alfy
    .fetch(ankiConnectURI, {
      method: 'POST',
      body: {
        action: 'findNotes',
        version: 6,
        params: {
          query: search,
        },
      },
    })

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
        console.error('actions#findNotes found %s ids %j', term, res.result);
        if (res.result.length > 1) {
          console.error('actions#findNotes found %s ids %j', term, res.result);
        }

        return res.result;
      }
    });
}

const updateExistingNote = async (fields: Data, tags: string[]) => {
  const [firstNote] = await findExistingNotesId(fields.Finnish);

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
  tags,
  term,
}: {
  term: string;
  tags: string[];
  meaning: string;
}) => {
  await updateSettings();
  if (!settings.enabled) return;
  const shouldCreateNewNote = await canAddNote(term);

  const fieldsLike: Data = {
    Finnish: term,
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
    console.error('Creating new note %s', term);
    await createNewNote(fieldsLike, tags);
  } else {
    console.error('Updating existing note %s', term);
    await updateExistingNote(fieldsLike, tags);
  }
};
