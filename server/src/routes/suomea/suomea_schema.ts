import type { Schema } from '@coobaha/typed-fastify';
import type {
  SanakirjaData,
  SkSearchResult,
  SkSearchResultWithData,
  WiktionaryData,
} from '../../shared/types.js';
import type { MyImage } from './suomea_types.js';

type BaseQuery = {
  q: string;
};

type QueryWithLang = {
  q: string;
  lang: 'en' | 'ru' | 'fi';
};

export interface SuomeaSchema extends Schema {
  paths: {
    'GET /wk': {
      request: {
        querystring: BaseQuery;
      };
      response: {
        200: { content: WiktionaryData };
      };
    };
    'GET /sk': {
      request: {
        querystring: QueryWithLang;
      };
      response: {
        200: { content: SanakirjaData };
      };
    };
    'GET /sk_search': {
      request: {
        querystring: QueryWithLang;
      };
      response: {
        200: { content: SkSearchResult[] };
      };
    };
    'GET /sk_search_with_data': {
      request: {
        querystring: QueryWithLang;
      };
      response: {
        200: { content: SkSearchResultWithData[] };
      };
    };
    'GET /wk_search': {
      request: {
        querystring: BaseQuery;
      };
      response: {
        200: {
          content: {
            results: string[];
            urls: string[];
          };
        };
      };
    };
    'GET /images': {
      request: {
        querystring: BaseQuery;
      };
      response: {
        200: { content: MyImage[] };
      };
    };
  };
}
