import FastifySensible from 'fastify-sensible';
import FastifyFormbody from 'fastify-formbody';
import addSchema, { asReply, Service } from '@coobaha/typed-fastify';

import { findImages } from '../../shared/images';
import { SanakirjaData, SkSearchResult } from '../../shared/types';
import { fetchSk, fetchWiktionary } from '../../shared/search';
// @ts-ignore
import FastifyCaching from 'fastify-caching';

import Etag from 'fastify-etag';

import got from 'got';
import qs from 'qs';
import jsonSchema from './suomea_schema.gen.json';
import { SuomeaSchema } from './suomea_schema';
import { FastifyInstance } from 'fastify';

const suomeaRoute = async (fastify: FastifyInstance): Promise<void> => {
  const service: Service<SuomeaSchema> = {
    'GET /images': async function (request, reply) {
      const search = request.query;
      const images = await findImages(search.q, request.log);
      return reply.status(200).send(images);
    },
    'GET /wk': async function (request, reply) {
      const search = request.query;
      let payload = await fetchWiktionary(search.q).catch((e) =>
        request.log.error(e),
      );
      if (!payload) {
        if (search.q !== search.q.toLowerCase()) {
          const term = search.q.toLowerCase();
          payload = await fetchWiktionary(term).catch((e) =>
            request.log.error(e),
          );
        }
      }

      if (payload) {
        return reply.status(200).send(payload);
      } else {
        return asReply(reply.notFound());
      }
    },
    'GET /sk': async function (request, reply) {
      const search = request.query;

      let payload = await fetchSk(search.q, search.lang).catch((e) =>
        request.log.error(e),
      );

      if (!payload) {
        if (search.q !== search.q.toLowerCase()) {
          const term = search.q.toLowerCase();
          payload = await fetchSk(term, search.lang).catch((e) =>
            request.log.error(e),
          );
        }
      }

      return payload
        ? reply.status(200).send(payload)
        : asReply(reply.notFound());
    },
    'GET /sk_search': async (request, reply) => {
      const search = request.query;

      const langs: Record<string, number> = {
        fi: 17,
        en: 3,
        ru: 22,
      };

      const url = `https://autocomplete-0.sanakirja.org/?${qs.stringify({
        text: search.q,
        sourceLanguage: langs[search.lang],
        targetLanguage: 17,
        locale: 'fi',
      })}`;

      const data:
        | { status: 'ok'; words: SkSearchResult[] }
        | { status: 'error' } = await got(url).json();

      switch (data.status) {
        case 'error':
          request.log.error(data);
          return reply.status(200).send([]);

        case 'ok': {
          return reply.status(200).send(data.words);
        }
      }
    },
    'GET /sk_search_with_data': async (request, reply) => {
      const search = request.query;

      const langs: Record<string, number> = {
        fi: 17,
        en: 3,
        ru: 22,
      };

      const url = `https://autocomplete-0.sanakirja.org/?${qs.stringify({
        text: search.q,
        sourceLanguage: langs[search.lang],
        targetLanguage: 17,
        locale: 'fi',
      })}`;

      const data:
        | { status: 'ok'; words: SkSearchResult[] }
        | { status: 'error' } = await got(url).json();

      switch (data.status) {
        case 'error':
          request.log.error(data);
          return reply.status(200).send([]);

        case 'ok': {
          const d = await Promise.all(
            data.words.map((w) =>
              fetchSk(w.text, search.lang)
                .then((data) => ({
                  ...w,
                  data: data,
                }))
                .catch((e) => w),
            ),
          );

          return reply
            .status(200)
            .send(
              d.filter(
                (word): word is SkSearchResult & { data: SanakirjaData } =>
                  'data' in word,
              ),
            );
        }
      }
    },
    'GET /wk_search': async (request, reply) => {
      const search = request.query;

      const url = `https://en.wiktionary.org/w/api.php?${qs.stringify({
        search: search.q,
        action: 'opensearch',
        limit: 10,
      })}`;

      const [, results, , urls]: [
        string,
        string[],
        unknown,
        string[],
      ] = await got(url).json();
      return reply.status(200).send({
        results,
        urls,
      });
    },
  };
  addSchema<SuomeaSchema>(fastify, {
    jsonSchema,
    service: service,
  });
  fastify.register(FastifySensible);
  fastify.register(FastifyFormbody);
  fastify.register(Etag);
  fastify.register(FastifyCaching, {
    privacy: FastifyCaching.privacy.PRIVATE,
    expiresIn: 600,
    cacheSegment: 'anki',
  });
};

export default suomeaRoute;
