import fp from 'fastify-plugin';
import * as crypto from 'crypto';
import Helmet from 'helmet';
import FastifyCors from 'fastify-cors';
import { FastifyReply } from 'fastify';

export interface NoncePluginOptions {}

const allowCspImages = function (this: { raw: FastifyReply['raw'] }) {
  this.raw.cspAllowAllImages = true;
};

const middleware = Helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': [`'self'`],
      'base-uri': [`'self'`],
      'block-all-mixed-content': [],
      'font-src': [`'self'`, 'https:', 'data:'],
      'frame-ancestors': [`'self'`],
      'object-src': [`'none'`],
      'script-src': [`'self'`],
      'script-src-attr': [`'none'`],
      'style-src': [`'self'`, 'https:', `'unsafe-inline'`],
      'upgrade-insecure-requests': [],
      'frame-src': [
        'self',
        'https://www.sanakirja.org',
        'https://en.wiktionary.org/',
      ],
      'img-src': [(req, res) => (res.cspAllowAllImages ? '*' : `'self' data:`)],
    },
  },
});

export default fp<NoncePluginOptions>(async (fastify, opts) => {
  fastify.decorateRequest('nonce', null);
  fastify.decorateReply('allowCspImages', allowCspImages);
  fastify.addHook('onRequest', (req, reply, done) => {
    reply.raw.nonce = `nonce-${crypto.randomBytes(16).toString('hex')}`;

    done();
  });

  fastify.addHook('onSend', function (req, reply, payload, done) {
    return middleware(req.raw, reply.raw, (err: any) => done(err, payload));
  });
  fastify.register(FastifyCors, {
    origin: '*',
  });
});

// When using .decorate you have to specify added properties for Typescript
declare module 'http' {
  export interface ServerResponse {
    nonce: string;
    cspAllowAllImages?: boolean;
  }
}

declare module 'fastify' {
  export interface FastifyReply {
    readonly allowCspImages: typeof allowCspImages;
  }
}
