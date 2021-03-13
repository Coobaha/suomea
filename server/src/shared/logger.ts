import pino, { LogFn } from 'pino';
const logger = pino();

export default {
  info: (msg: string, ...args: any[]) => logger.info(msg, ...args),
  warn: (msg: string, ...args: any[]) => logger.warn(msg, ...args),
  error: (msg: string, ...args: any[]) => logger.error(msg, ...args),
} as {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
};
