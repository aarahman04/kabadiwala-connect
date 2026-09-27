/**
 * Persistence for the server state. The state is small (a demo-scale dataset),
 * so it's held in memory and written through as one JSON document per change:
 *  - DATABASE_URL set → Postgres (Railway), table kc_state
 *  - DATA_FILE set    → JSON file (local dev / a mounted volume)
 *  - neither          → memory only (tests)
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { initialServerState, normalizeState, type ServerState } from '../src/services/serverCore';

export interface Store {
  readonly kind: string;
  load(): Promise<ServerState>;
  save(state: ServerState): Promise<void>;
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
    // On Railway, use the private DATABASE_URL (*.railway.internal) — no TLS
    // needed inside the project network. DATABASE_SSL=require for an external
    // database with a properly issued certificate (verified).
    const ssl = process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : false;
    this.pool = new pg.Pool({ connectionString: this.url, ssl });
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS kc_state (id INT PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    return this.pool;
  }

  async load() {
    const db = await this.db();
    const { rows } = await db.query<{ state: Partial<ServerState> }>('SELECT state FROM kc_state WHERE id = 1');
    if (rows[0]) return normalizeState(rows[0].state);
    const fresh = initialServerState();
    await this.save(fresh);
    return fresh;
  }

  async save(state: ServerState) {
    const db = await this.db();
    await db.query(
      'INSERT INTO kc_state (id, state, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()',
      [JSON.stringify(state)],
    );
  }
}

export function storeFromEnv(env = process.env): Store {
  if (env.DATABASE_URL) return new PostgresStore(env.DATABASE_URL);
  if (env.DATA_FILE) return new FileStore(env.DATA_FILE);
  return new MemoryStore();
}
