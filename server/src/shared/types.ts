export type ImageT = {
  name: string;
  thumb_large: string;
  width: number;
  height: number;
};

export type WiktionaryData = {
  wk_decl?: string | null;
  wk_notes?: string | null;
  wk_translation?: string | null;
  wk_url?: string | null;
  wk_possessive?: string | null;
  wk_synonyms?: string | null;
  etymology?: string | null;
  suffix?: string | null;
  Finnish: string;
  compounds?: string | null;
  wordtype?: string | null;
  wk_antonyms?: string | null;
  wk_derived?: string | null;
  meta: {
    gradation?: string;
    kotus?: number;
    kotus_word?: string;
    verb?: {
      type: number;
    };
    adjective?: {
      comparative?: string,
      superlative?: string
    }
  };

};

export type SanakirjaData = {
  sk_translation?: string;
  sk_translation_strings?: string[];
  sk_url?: string;
  Finnish: string;
  sk_synonyms?: string;
};

export type Data = WiktionaryData & {
  sk_en_url?: string;
  en_synonyms?: string | null;
  ru_translation?: string;
  sk_ru_url?: string;
  en_translation?: string;
  meaning?: string;
  own_answer?: string;
  ru_synonyms?: string | null;
};

export interface SkSearchResult {
  text: string;
  id: number;
  translation_count: number;
}

export type WkSearchResult = {
  results: string[];
  urls: string[];
};

export interface Note {
  noteId: number;
  tags: string[];
  fields: Record<string, Field | undefined>;
  modelName: string;
  cards: number[];
}

export interface Field {
  value: string;
  order: number;
}
