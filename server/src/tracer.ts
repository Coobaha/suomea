import dd from 'dd-trace';

const tracer = dd.init({
  enabled: process.env.NODE_ENV === 'production',
  logInjection: true,
  analytics: true
});

tracer.use('fastify', {
  analytics: true,
});

tracer.use('pino');
