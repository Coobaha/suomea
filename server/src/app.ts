import 'dd-trace/init';
import * as path from 'path';
import AutoLoad, { AutoloadPluginOptions } from 'fastify-autoload';
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import FastifySensible from 'fastify-sensible';
import qs from 'qs';
import FastifyBlipp from 'fastify-blipp';
import oas from 'fastify-oas';
import FastifyRateLimit from 'fastify-rate-limit';
import * as process from 'process';

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  // Place here your custom code!
  fastify.register(FastifySensible);
  if (process.env.NODE_ENV === 'production') {
    fastify.log.info('Rate limit was enabled');
    fastify.register(FastifyRateLimit, {
      max: 150,
      timeWindow: '1 minute',
    });
    const StatsD = await import('hot-shots');

    fastify.register(import('fastify-datadog'), {
      dogstatsd: new StatsD.default(),
      path: true,
      method: true,
      responseCode: true,
    });
  }

  await fastify.register(FastifyBlipp);
  await fastify.register(oas, {
    swagger: {
      servers: [{ url: 'http://localhost:3000' }],

      info: {
        title: 'Test openapi',
        description: 'testing the fastify swagger api',
        version: '0.1.0',
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here',
      },
      consumes: ['application/json'],
      produces: ['application/json'],
    },
    exposeRoute: process.env.NODE_ENV !== 'production',
    addModels: false,
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: opts,
  });

  await fastify.blipp();
};

export const options: FastifyServerOptions = {
  querystringParser: qs.parse,

  // logger: {
  //   prettyPrint: true,
  //

  //   level: 'info',
  //   serializers: {
  //     req(req) {
  //       return {
  //         method: req.method,
  //         url: req.url,
  //         headers: req.headers,
  //         // @ts-ignore
  //         hostname: req.hostname,
  //         // @ts-ignore
  //         remoteAddress: req.ip,
  //         remotePort: req.connection.remotePort,
  //       };
  //     },
  //     res(res) {
  //       return {
  //         headers: res.getHeaders(),
  //         statusCode: res.statusCode,
  //         statusMessage: res.statusMessage,
  //       };
  //     },
  //   },
  // },
};

export default app;
