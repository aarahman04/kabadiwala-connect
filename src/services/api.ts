/**
 * The only module that talks to "the server". Two transports, same functions:
 *
 *  - **Remote** (VITE_API_URL set at build time): real HTTP backend in
 *    /server, shared by every device — collector and recycler phones sync.
 *  - **Local mock** (no VITE_API_URL): the same server logic (serverCore.ts)
 *    run in-page against localStorage, with fake latency. Only tabs of one
 *    browser share it. Used by tests and as a zero-setup fallback.
 *
 * Either way, a network failure surfaces as OfflineError so the sync queue
 * halts and retries later, and a validation refusal as a plain Error.
 */
import type { PriceEntry, Recycler, SyncOp } from '../data/models';
import { OfflineError } from '../logic/sync';
import {
  applyOp,
  handoverByReference,
  handoversForRecycler,
  initialServerState,
  normalizeState,
  updatesFor,
  type RemoteHandover,
  type RemoteHandoverUpdate,
  type ServerState,
} from './serverCore';

export type { RemoteHandover, RemoteHandoverUpdate } from './serverCore';

const SERVER_KEY = 'kc-mock-server-v1';
export const SIMULATE_OFFLINE_KEY = 'kc-simulate-offline';
const REQUEST_TIMEOUT_MS = 10_000;

let apiBase: string | undefined = (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || undefined;

/** Tests / demo override. Pass undefined to use the local mock. */
export function setApiBase(url: string | undefined): void {
  apiBase = url?.replace(/\/+$/, '') || undefined;
}

export function usingRemoteBackend(): boolean {
  return !!apiBase;
}

/** CSV download links for the problem statement's datasets (remote backend only). */
export function datasetExportLinks(): { name: string; url: string }[] {
  if (!apiBase) return [];
  return ['materials', 'prices', 'recyclers', 'transactions', 'traceability', 'collectors', 'flags', 'audit'].map(
    (name) => ({ name, url: `${apiBase}/api/export/${name}.csv` }),
  );
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

/** Demo switch for laptops where toggling real wifi is awkward. */
export function isSimulatedOffline(): boolean {
  return localStorage.getItem(SIMULATE_OFFLINE_KEY) === '1';
}

export function setSimulatedOffline(offline: boolean): void {
  if (offline) localStorage.setItem(SIMULATE_OFFLINE_KEY, '1');
  else localStorage.removeItem(SIMULATE_OFFLINE_KEY);
  window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
}

export function isOnline(): boolean {
  return navigator.onLine && !isSimulatedOffline();
}

// ---------------------------------------------------------------------------
// Remote transport
// ---------------------------------------------------------------------------

async function remote<T>(path: string, init?: { method: 'POST'; body: unknown }): Promise<T> {
  if (!isOnline()) throw new OfflineError();
  let res: Response;
  try {
    res = await fetch(apiBase + path, {
      method: init?.method ?? 'GET',
      headers: init ? { 'content-type': 'application/json' } : undefined,
      body: init ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new OfflineError('network unreachable');
  }
  // 5xx / gateway errors are transient (server asleep, redeploying): retry later.
  if (res.status >= 500) throw new OfflineError(`server ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

// ---------------------------------------------------------------------------
// Local mock transport
// ---------------------------------------------------------------------------

function load(): ServerState {
  const raw = localStorage.getItem(SERVER_KEY);
  if (raw) return normalizeState(JSON.parse(raw) as Partial<ServerState>);
  const fresh = initialServerState();
  save(fresh);
  return fresh;
}

function save(state: ServerState): void {
  localStorage.setItem(SERVER_KEY, JSON.stringify(state));
}

async function local<T>(handler: (s: ServerState) => T | Promise<T>): Promise<T> {
  if (!isOnline()) throw new OfflineError();
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
  if (!isOnline()) throw new OfflineError(); // dropped mid-request
  return handler(load());
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function fetchRecyclers(): Promise<Recycler[]> {
  return apiBase ? remote('/api/recyclers') : local((s) => s.recyclers);
}

export function fetchPrices(): Promise<PriceEntry[]> {
  return apiBase ? remote('/api/prices') : local((s) => s.prices);
}

/** Apply one queued client write. */
export async function pushOp(op: SyncOp): Promise<void> {
  if (apiBase) {
    await remote('/api/ops', { method: 'POST', body: { op } });
    return;
  }
  await local(async (s) => {
    await applyOp(s, op);
    save(s);
  });
}

/** Confirmations the collector hasn't necessarily seen yet. */
export function pullUpdates(collectorId: string): Promise<RemoteHandoverUpdate[]> {
  return apiBase
    ? remote(`/api/updates?collectorId=${encodeURIComponent(collectorId)}`)
    : local((s) => updatesFor(s, collectorId));
}

/** Recycler-side lookup of a handover code that isn't on this device. */
export async function lookupHandover(reference: string): Promise<RemoteHandover | null> {
  if (!apiBase) return local((s) => handoverByReference(s, reference));
  const { handover } = await remote<{ handover: RemoteHandover | null }>(
    `/api/handovers/${encodeURIComponent(reference)}`,
  );
  return handover;
}

/** Recycler worklist: every handover addressed to this recycler. */
export async function fetchRecyclerHandovers(recyclerId: string): Promise<RemoteHandover[]> {
  if (!apiBase) return local((s) => handoversForRecycler(s, recyclerId));
  const { handovers } = await remote<{ handovers: RemoteHandover[] }>(
    `/api/recyclers/${encodeURIComponent(recyclerId)}/handovers`,
  );
  return handovers;
}

/** Demo helper: wipe the local mock server (used by "Reset demo"). */
export function resetServer(): void {
  localStorage.removeItem(SERVER_KEY);
}
