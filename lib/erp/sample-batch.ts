import { randomUUID } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import { atomicBatch, type Database } from './database';

type SampleRow = Record<string, string | number | null>;
export type SampleGroup = { table: string; rows: SampleRow[] };
const requestBudget = 192 * 1024;
const rowBudget = 64 * 1024;
const stagingTable = 'erp_sample_import';

// Reads and run-scoped upserts can be retried after a dropped HTTP socket.
// The final business-data commit is deliberately never blindly retried.
export async function sampleStep<T>(
  phase: string,
  operation: () => Promise<T>,
  retrySafe = false,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        retrySafe &&
        attempt < 2 &&
        error instanceof TypeError &&
        error.message === 'fetch failed'
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (attempt + 1)),
        );
        continue;
      }
      throw new Error(
        `Sample ${phase}: ${error instanceof Error ? error.message : 'operation failed'}`,
        { cause: error },
      );
    }
  }
}

/** Upload isolated, bounded chunks without holding an interactive transaction.
 * Business rows and the completion marker become visible in one guarded commit.
 * Failed imports discard only their own staging rows and never reset user data.
 */
export async function commitSampleGroups(
  db: Database,
  groups: SampleGroup[],
  guards: InStatement[],
) {
  const runId = randomUUID();
  const createdAt = Date.now();
  await sampleStep(
    'staging setup',
    () =>
      atomicBatch(db, [
        {
          sql: `CREATE TABLE IF NOT EXISTS ${stagingTable} (run_id TEXT NOT NULL, slot INTEGER NOT NULL, table_name TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at INTEGER NOT NULL, PRIMARY KEY(run_id,slot))`,
          args: [],
        },
        {
          sql: `DELETE FROM ${stagingTable} WHERE created_at<?`,
          args: [createdAt - 24 * 60 * 60 * 1000],
        },
      ]),
    true,
  );
  let committed = false;
  try {
    const uploads: InStatement[] = [];
    let slot = 0;
    for (const group of groups) {
      if (!/^[a-z_]+$/.test(group.table))
        throw new Error('Invalid internal sample table.');
      let chunk: string[] = [];
      let size = 2;
      const stage = () => {
        if (!chunk.length) return;
        uploads.push({
          sql: `INSERT INTO ${stagingTable} VALUES (?,?,?,?,?) ON CONFLICT(run_id,slot) DO NOTHING`,
          args: [runId, slot++, group.table, `[${chunk.join(',')}]`, createdAt],
        });
        chunk = [];
        size = 2;
      };
      for (const row of group.rows) {
        const encoded = JSON.stringify(row);
        const bytes = Buffer.byteLength(encoded) + 1;
        if (bytes > rowBudget)
          throw new Error('Sample row exceeds the upload limit.');
        if (size + bytes > rowBudget) stage();
        chunk.push(encoded);
        size += bytes;
      }
      stage();
    }
    let batch: InStatement[] = [];
    let size = 2;
    for (const statement of uploads) {
      const bytes = Buffer.byteLength(JSON.stringify(statement)) + 1;
      if (bytes > requestBudget)
        throw new Error('Sample upload exceeds the request limit.');
      if (size + bytes > requestBudget) {
        const uploading = batch;
        await sampleStep(
          'staging upload',
          () => atomicBatch(db, uploading),
          true,
        );
        batch = [];
        size = 2;
      }
      batch.push(statement);
      size += bytes;
    }
    if (batch.length)
      await sampleStep('staging upload', () => atomicBatch(db, batch), true);
    const inserts: InStatement[] = groups
      .filter((g) => g.rows.length)
      .map((group) => {
        const columns = Object.keys(group.rows[0]);
        if (columns.some((c) => !/^[a-z_]+$/.test(c)))
          throw new Error('Invalid internal sample column.');
        return {
          sql: `INSERT INTO ${group.table} (${columns.join(',')}) SELECT ${columns.map((c) => `json_extract(j.value,'$.${c}')`).join(',')} FROM ${stagingTable} p,json_each(p.payload) j WHERE p.run_id=? AND p.table_name=? ORDER BY p.slot,CAST(j.key AS INTEGER)`,
          args: [runId, group.table],
        };
      });
    await sampleStep('final commit', () =>
      atomicBatch(db, [
        ...guards,
        ...inserts,
        { sql: `DELETE FROM ${stagingTable} WHERE run_id=?`, args: [runId] },
      ]),
    );
    committed = true;
  } finally {
    if (!committed) {
      try {
        await atomicBatch(db, [
          { sql: `DELETE FROM ${stagingTable} WHERE run_id=?`, args: [runId] },
        ]);
      } catch {
        console.error('Sample import staging cleanup deferred.');
      }
    }
  }
}
