import { configuredDatabase } from './database';
import { createHandler } from './http';

let handler: ReturnType<typeof createHandler> | undefined;

export async function handleErp(request: Request) {
  const origin = process.env.ERP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (!origin)
    return Response.json(
      {
        error:
          'Shared ERP storage is unavailable. Configure the public origin on the Node server.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  try {
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )
    )
      throw new Error(
        'Use a persistent database and an HTTPS origin outside loopback.',
      );
    handler ??= createHandler(configuredDatabase(), url.origin);
    return await handler(request);
  } catch (error) {
    console.error(
      'ERP database startup failed:',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return Response.json(
      {
        error:
          'Shared ERP storage could not be opened. On Render, configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
