import { write, type Database } from './database';
import { authenticate, clearSession, login, sessionCookie } from './auth';
import {
  getRegister,
  report,
  reportCsv,
  updateRegister,
  workspace,
} from './attendance';
import { readSetup, updateSetup } from './setup';
import {
  dateValue,
  ErpError,
  missing,
  object,
  requiredText,
} from './validation';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

async function bodyObject(request: Request) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new ErpError(415, 'Send an application/json request.');
  const reader = request.body?.getReader();
  if (!reader) throw new ErpError(400, 'A request body is required.');
  const decoder = new TextDecoder();
  let size = 0;
  let content = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 128 * 1024) {
      await reader.cancel();
      throw new ErpError(413, 'Request is too large.');
    }
    content += decoder.decode(value, { stream: true });
  }
  try {
    return object(JSON.parse(content + decoder.decode()));
  } catch {
    throw new ErpError(400, 'Invalid JSON request.');
  }
}

function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { ...privateHeaders, ...headers },
  });
}

export function createHandler(db: Database, publicOrigin?: string) {
  const configuredOrigin = publicOrigin
    ? new URL(publicOrigin).origin
    : undefined;
  return async (request: Request) => {
    try {
      const url = new URL(request.url);
      const origin = configuredOrigin ?? url.origin;
      const method = request.method;
      if (method !== 'GET' && method !== 'POST')
        return json({ error: 'Method not allowed.' }, 405, {
          Allow: 'GET, POST',
        });
      if (method === 'POST' && request.headers.get('origin') !== origin)
        throw new ErpError(
          403,
          'Requests that change records must come from the ERP site.',
        );
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'api' || parts[1] !== 'erp') missing();
      const path = parts.slice(2);
      const endpoint = path[0];
      const secure = origin.startsWith('https://');
      if (method === 'POST' && endpoint === 'login' && path.length === 1) {
        const body = await bodyObject(request);
        const token = await login(db, request, body.username, body.password);
        return json({ ok: true }, 200, {
          'Set-Cookie': sessionCookie(token, secure),
        });
      }
      // Read the full body before resolving scope, so revocation takes effect at mutation time.
      const body =
        method === 'POST' && endpoint !== 'logout'
          ? await bodyObject(request)
          : {};
      const account = await authenticate(db, request);
      if (path.length === 1) {
        if (method === 'POST' && endpoint === 'logout') {
          await write(db, (tx) => clearSession(tx, request));
          return json({ ok: true }, 200, {
            'Set-Cookie': sessionCookie('', secure),
          });
        }
        if (method === 'GET' && endpoint === 'session')
          return json(await workspace(db, account));
        if (endpoint === 'setup')
          return json(
            method === 'GET'
              ? await readSetup(db, account)
              : await updateSetup(db, account, body),
          );
        if (method === 'GET' && endpoint === 'report') {
          const view = await report(
            db,
            account,
            dateValue(url.searchParams.get('date')),
            url.searchParams.get('school'),
          );
          if (url.searchParams.get('format') === 'csv')
            return new Response(reportCsv(view), {
              headers: {
                ...privateHeaders,
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="attendance-${view.date}.csv"`,
              },
            });
          return json(view);
        }
      }
      if (endpoint === 'register' && path.length === 3) {
        const classId = requiredText(path[1], 'Class', 64);
        const date = dateValue(path[2]);
        return json(
          method === 'GET'
            ? await getRegister(db, account, classId, date)
            : await updateRegister(db, account, classId, date, body),
        );
      }
      missing();
    } catch (error) {
      if (error instanceof ErpError)
        return json({ error: error.message }, error.status);
      console.error(
        'ERP request failed:',
        error instanceof Error ? error.name : 'Unknown error',
      );
      return json(
        { error: 'The server could not complete this request.' },
        500,
      );
    }
  };
}
