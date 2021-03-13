import { FastifyLoggerInstance } from 'fastify';
import { googleImages, myImages } from './search';
import { ImageT } from './types';

export async function findImages(term: string, log: FastifyLoggerInstance) {
  let images = await myImages(term).catch((e) => {
    log.error(e);
    return [] as ImageT[];
  });

  if (images.length === 0) {
    const gmages = await googleImages(term).catch((e) => {
      log.error(e);
      return [] as ImageT[];
    });
    images = images.concat(gmages.slice(0, 10));
  }
  return images.slice(0, 30);
}
