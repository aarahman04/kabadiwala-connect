/**
 * Persistence for the server state. The state is small (a demo-scale dataset),
 * so it's held in memory and written through after every accepted change:
 *  - DATABASE_URL set → Postgres (Supabase or Railway): one kc_* table per
 *    dataset, see schema.ts / database/schema.sql
 *  - DATA_FILE set    → JSON file (local dev / a mounted volume)
 *  - neither          → memory only (tests)
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ConfirmationPayload, Transaction } from '../../src/data/models';
import {
  initialServerState,
  normalizeState,
  type ServerLot,
  type ServerRecord,
  type ServerState,
  type TransactionFlag,
} from '../../src/services/serverCore';
import { SCHEMA_SQL, TABLES } from './schema';

export interface Store {
  readonly kind: string;
  load(): Promise<ServerState>;
  save(state: ServerState): Promise<void>;
  /** Replace everything (admin reset). Defaults to save(). */
  reset?(state: ServerState): Promise<void>;
}

export class MemoryStore implements Store {
  readonly kind = 'memory';
  private state: ServerState | null = null;
  async load() {
    return (this.state ??= initialServerState());
  }
  async save(state: ServerState) {
    this.state = state;
  }
}

export class FileStore implements Store {
  readonly kind = 'file';
  constructor(private path: string) {}
  async load() {
    try {
      return normalizeState(JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      const fresh = initialServerState();
      await this.save(fresh);
      return fresh;
    }
  }
  async save(state: ServerState) {
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = this.path + '.tmp';
    await writeFile(tmp, JSON.stringify(state));
    await rename(tmp, this.path); // atomic replace
  }
}

export class PostgresStore implements Store {
  readonly kind = 'postgres';
  private pool: import('pg').Pool | null = null;
  constructor(private url: string) {}

  private async db() {
    if (this.pool) return this.pool;
    const { default: pg } = await import('pg');
    this.pool = new pg.Pool(pgConfig(this.url));
    await this.pool.query(SCHEMA_SQL);
    return this.pool;
  }

  async load(): Promise<ServerState> {
    const db = await this.db();
    const rows = async <T>(table: string, order: string) =>
      (await db.query<{ data: T }>(`select data from ${table} order by ${order}`)).rows.map((r) => r.data);

    const recyclers = await rows<ServerState['recyclers'][number]>(TABLES.recyclers, 'recycler_id');
    if (recyclers.length === 0) {
      const fresh = initialServerState();
      await this.save(fresh);
      return fresh;
    }
    const byKey = <T>(list: T[], key: (x: T) => string) => Object.fromEntries(list.map((x) => [key(x), x]));
    return normalizeState({
      recyclers,
      prices: await rows(TABLES.prices, 'observed_at, price_key'),
      lots: byKey(await rows<ServerLot>(TABLES.lots, 'lot_id'), (l) => l.lotId),
      transactions: byKey(await rows<Transaction>(TABLES.transactions, 'transaction_id'), (t) => t.transactionId),
      traceability: byKey(await rows<ServerRecord>(TABLES.traceability, 'handover_reference'), (r) => r.handoverReference),
      confirmations: byKey(
        await rows<ConfirmationPayload>(TABLES.confirmations, 'handover_reference'),
        (c) => c.handoverReference,
      ),
      flags: byKey(await rows<TransactionFlag>(TABLES.flags, 'transaction_id'), (f) => f.transactionId),
      audit: await rows(TABLES.audit, 'seq'),
    });
  }

  /**
   * Upserts every record (the demo dataset is small). Rows only ever grow or
   * change in place, so there is nothing to delete except on reset().
   */
  async save(state: ServerState): Promise<void> {
    const db = await this.db();
    const client = await db.connect();
    const upsert = (table: string, keyCol: string, keyExpr: string, list: unknown[], touch = true) =>
      client.query(
        `insert into ${table} (${keyCol}, data)
         select ${keyExpr}, e from jsonb_array_elements($1::jsonb) with ordinality as t(e, ord)
         on conflict (${keyCol}) do update set data = excluded.data${touch ? ', updated_at = now()' : ''}
         where ${table}.data is distinct from excluded.data`,
        [JSON.stringify(list)],
      );
    const appendOnly = (table: string, keyCol: string, keyExpr: string, list: unknown[]) =>
      client.query(
        `insert into ${table} (${keyCol}, data)
         select ${keyExpr}, e from jsonb_array_elements($1::jsonb) with ordinality as t(e, ord)
         on conflict (${keyCol}) do nothing`,
        [JSON.stringify(list)],
      );
    try {
      await client.query('begin');
      await upsert(TABLES.recyclers, 'recycler_id', "e->>'recyclerId'", state.recyclers);
      await appendOnly(TABLES.prices, 'price_key', 'md5(e::text)', state.prices);
      await upsert(TABLES.lots, 'lot_id', "e->>'lotId'", Object.values(state.lots));
      await upsert(TABLES.transactions, 'transaction_id', "e->>'transactionId'", Object.values(state.transactions));
      await upsert(
        TABLES.traceability,
        'handover_reference',
        "e->>'handoverReference'",
        Object.values(state.traceability),
      );
      await upsert(
        TABLES.confirmations,
        'handover_reference',
        "e->>'handoverReference'",
        Object.values(state.confirmations),
        false,
      );
      await upsert(TABLES.flags, 'transaction_id', "e->>'transactionId'", Object.values(state.flags), false);
      await appendOnly(TABLES.audit, 'seq', 'ord', state.audit);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async reset(state: ServerState): Promise<void> {
    const db = await this.db();
    await db.query(`truncate ${Object.values(TABLES).join(', ')}`);
    await this.save(state);
  }
}

/**
 * Connection settings.
 *  - Railway Postgres: use the private DATABASE_URL (*.railway.internal) — no TLS.
 *  - Supabase (or any external Postgres): DATABASE_SSL=require. Supabase signs
 *    its certificates with its own root CA, so also set DATABASE_CA to the PEM
 *    from Dashboard -> Database -> SSL Configuration. Verification stays on.
 */
function pgConfig(url: string): import('pg').PoolConfig {
  if (process.env.DATABASE_SSL !== 'require') return { connectionString: url, ssl: false, max: 5 };
  // An sslmode in the URL would override the ssl object below; ours wins.
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  // Env UIs often store a pasted PEM with literal "\n" sequences.
  const ca = process.env.DATABASE_CA?.replace(/\\n/g, '\n');
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, max: 5 };
}

export function storeFromEnv(env = process.env): Store {
  if (env.DATABASE_URL) return new PostgresStore(env.DATABASE_URL);
  if (env.DATA_FILE) return new FileStore(env.DATA_FILE);
  return new MemoryStore();
}
