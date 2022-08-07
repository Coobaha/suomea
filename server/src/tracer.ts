import dd from 'dd-trace';

if (process.env['NODE_ENV'] === 'production') {
  process.env['DD_TRACE_ENABLED'] = 'true';
  const tracer = dd.init({
    logInjection: true,
    runtimeMetrics: true,
  });
  tracer.use('fastify', {});
  tracer.use('pino');
}
