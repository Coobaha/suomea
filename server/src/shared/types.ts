export type ImageT = {
  name: string;
  thumb_large: string;
  width: number;
  height: number;
};

export type WiktionaryData = {
  wk_decl?: string | null | undefined;
  wk_notes?: string | null | undefined;
  wk_translation?: string | null | undefined;
  wk_url?: string | null | undefined;
  wk_possessive?: string | null | undefined;
  wk_synonyms?: string | null | undefined;
  etymology?: string | null | undefined;
  suffix?: string | null | undefined;
  Finnish: string;
  compounds?: string | null | undefined;
  wordtype?: string | null | undefined;
  wk_antonyms?: string | null | undefined;
  wk_derived?: string | null | undefined;
  meta: {
    gradation?: string;
    kotus?: number;
    kotus_word?: string;
    syllabification?: string;
    verb?: {
      type: number;
    };
    adjective?: {
      comparative: { term: string; missing: boolean }[];
      superlative: { term: string; missing: boolean }[];
    };
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

export type SkSearchResultWithData = SkSearchResult & { data?: SanakirjaData };

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
