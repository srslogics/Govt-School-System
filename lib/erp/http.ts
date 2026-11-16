import { seedExpandedDemo } from './expanded-demo';
import { one, write, type Database } from './database';
import { authenticate, clearSession, login, sessionCookie } from './auth';
import {
  getRegister,
  report,
  reportCsv,
  updateRegister,
  workspace,
} from './attendance';
import { readMaintenance, updateMaintenance } from './maintenance';
import { readLibrary, readBorrowers, updateLibrary } from './library';
import { readMunicipal, updateMunicipal, municipalCsv } from './municipal';
import { readOversight, updateOversight } from './oversight';
import { readOperations, updateOperations } from './operations';
import { readTeacher, updateTeacher } from './teacher';
import { readLearning, updateLearning } from './learning';
import { readSetup, updateSetup } from './setup';
import { readPortal, updatePortal } from './portal';
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
        if (endpoint === 'sample-data') {
          if (account.role !== 'administrator')
            throw new ErpError(
              403,
              'Only the setup administrator can load fictional sample content.',
            );
          if (method === 'GET') {
            const revision = process.env.RENDER_GIT_COMMIT;
            return json({
              release:
                revision && /^[a-f0-9]{40}$/i.test(revision)
                  ? revision.slice(0, 7)
                  : null,
              ...(await one<{
                schools: number;
                learners: number;
                expanded: number;
              }>(
                db,
                "SELECT (SELECT COUNT(*) FROM school) AS schools,(SELECT COUNT(*) FROM enrolment) AS learners,EXISTS(SELECT 1 FROM school_activity WHERE id='ss49-expanded-sample-v1') AS expanded",
              )),
            });
          }
          if (body.action !== 'expand')
            throw new ErpError(400, 'Choose the sample expansion action.');
          try {
            return json({ result: await seedExpandedDemo(db, origin) });
          } catch (error) {
            // Only the authenticated setup administrator receives bounded loader
            // diagnostics; the normal school UI keeps its existing error text.
            const clean = (message: string) => {
              let safe = message;
              for (const secret of [
                process.env.TURSO_AUTH_TOKEN,
                process.env.TURSO_DATABASE_URL,
              ])
                if (secret) safe = safe.split(secret).join('[redacted]');
              return safe
                .replace(/https?:\/\/[^\s]+/g, '[database endpoint]')
                .slice(0, 300);
            };
            return json(
              {
                error: 'Fictional sample content could not be loaded.',
                diagnostic:
                  error instanceof Error
                    ? {
                        name: error.name,
                        message: clean(error.message),
                        cause:
                          error.cause instanceof Error
                            ? clean(
                                [
                                  error.cause.message,
                                  error.cause.cause instanceof Error
                                    ? error.cause.cause.message
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(': '),
                              )
                            : undefined,
                      }
                    : { name: 'Unknown error' },
              },
              500,
            );
          }
        }

        if (method === 'POST' && endpoint === 'logout') {
          await write(db, (tx) => clearSession(tx, request));
          return json({ ok: true }, 200, {
            'Set-Cookie': sessionCookie('', secure),
          });
        }
        if (method === 'GET' && endpoint === 'session')
          return json(await workspace(db, account));
        if (endpoint === 'maintenance')
          return json(
            method === 'GET'
              ? await readMaintenance(db, account)
              : await updateMaintenance(db, account, body),
          );
        if (endpoint === 'library-borrowers' && method === 'GET')
          return json(
            await readBorrowers(
              db,
              account,
              url.searchParams.get('school'),
              url.searchParams.get('q') ?? '',
            ),
          );
        if (endpoint === 'library')
          return json(
            method === 'GET'
              ? await readLibrary(db, account, url.searchParams.get('school'))
              : await updateLibrary(db, account, body),
          );
        if (endpoint === 'municipal')
          return json(
            method === 'GET'
              ? await readMunicipal(db, account)
              : await updateMunicipal(db, account, body),
          );
        if (endpoint === 'oversight') {
          if (method === 'GET') {
            if (
              url.searchParams.get('format') === 'csv' &&
              account.role !== 'commissioner'
            )
              throw new ErpError(
                403,
                'Municipal summary exports are available to the Commissioner.',
              );
            const view = await readOversight(
              db,
              account,
              dateValue(url.searchParams.get('date')),
            );
            if (url.searchParams.get('format') === 'csv')
              return new Response(municipalCsv(view), {
                headers: {
                  ...privateHeaders,
                  'Content-Type': 'text/csv; charset=utf-8',
                  'Content-Disposition': `attachment; filename="municipal-summary-${view.date}.csv"`,
                },
              });
            return json(view);
          }
          return json(await updateOversight(db, account, body));
        }
        if (endpoint === 'operations')
          return json(
            method === 'GET'
              ? await readOperations(db, account)
              : await updateOperations(db, account, body),
          );
        if (endpoint === 'teacher')
          return json(
            method === 'GET'
              ? await readTeacher(
                  db,
                  account,
                  dateValue(url.searchParams.get('date')),
                )
              : await updateTeacher(db, account, body),
          );
        if (endpoint === 'learning')
          return json(
            method === 'GET'
              ? await readLearning(
                  db,
                  account,
                  dateValue(url.searchParams.get('date')),
                )
              : await updateLearning(db, account, body),
          );
        if (endpoint === 'portal')
          return json(
            method === 'GET'
              ? await readPortal(
                  db,
                  account,
                  dateValue(url.searchParams.get('date')),
                )
              : await updatePortal(db, account, body),
          );
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
