/**
 * Kabadiwala Connect API — tiny node:http server, no framework.
 * All business rules live in src/services/serverCore.ts (shared with the
 * in-browser mock); this file is routing, JSON, CORS and persistence.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type { SyncOp } from '../../src/data/models';
import {
  applyOp,
  handoverByReference,
  handoversForRecycler,
  initialServerState,
  pickupRequestsFor,
  pickupsFor,
  updatesFor,
  ValidationError,
  type ServerState,
} from '../../src/services/serverCore';
import type { Store } from './store';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const CLASSIFY_TIMEOUT_MS = 60_000;

export interface AppOptions {
  store: Store;
  corsOrigin?: string; // default "*"
  adminToken?: string; // enables POST /api/admin/reset
  classifierUrl?: string; // Python classifier service; enables POST /api/classify
}

export function createApp({ store, corsOrigin = '*', adminToken, classifierUrl }: AppOptions) {
  let state: ServerState | null = null;
  // Serialize every mutation: read-modify-write of one in-memory document.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };
  const current = async () => (state ??= await store.load());

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'GET' && (path === '/' || path === '/api/health')) {
        const s = await current();
        return json(res, 200, {
          ok: true,
          store: store.kind,
          counts: {
            recyclers: s.recyclers.length,
            prices: s.prices.length,
            lots: Object.keys(s.lots).length,
            transactions: Object.keys(s.transactions).length,
            handovers: Object.keys(s.traceability).length,
            flags: Object.keys(s.flags).length,
          },
        });
      }
      if (req.method === 'GET' && path === '/api/recyclers') return json(res, 200, (await current()).recyclers);
      if (req.method === 'GET' && path === '/api/prices') return json(res, 200, (await current()).prices);

      // Photo -> material category. The model runs in the separate Python
      // service (classifier/); this only forwards the multipart upload so the
      // app keeps talking to one API.
      if (req.method === 'POST' && path === '/api/classify') {
        if (!classifierUrl) return json(res, 503, { error: 'classifier not configured' });
        const body = await readBody(req, MAX_IMAGE_UPLOAD_BYTES);
        let upstream: Response;
        try {
          upstream = await fetch(`${classifierUrl.replace(/\/+$/, '')}/api/classify`, {
            method: 'POST',
            headers: { 'content-type': req.headers['content-type'] ?? 'application/octet-stream' },
            body: new Uint8Array(body),
            signal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
          });
        } catch {
          return json(res, 503, { error: 'classifier unreachable' });
        }
        const payload = await upstream.json().catch(() => ({ error: 'bad classifier response' }));
        const detail = (payload as { detail?: unknown }).detail;
        return json(res, upstream.status, upstream.ok ? payload : { error: typeof detail === 'string' ? detail : 'classification failed' });
      }

      if (req.method === 'POST' && path === '/api/ops') {
        const body = (await readJson(req)) as { op?: SyncOp };
        if (!body?.op || typeof body.op !== 'object' || !('kind' in body.op)) {
          return json(res, 400, { error: 'body must be { op }' });
        }
        await exclusive(async () => {
          const s = await current();
          const draft = structuredClone(s); // a rejected op must not half-apply
          await applyOp(draft, body.op!);
          await store.save(draft);
          state = draft;
        });
        return json(res, 200, { ok: true });
      }

      if (req.method === 'GET' && path === '/api/updates') {
        const collectorId = url.searchParams.get('collectorId');
        if (!collectorId) return json(res, 400, { error: 'collectorId required' });
        return json(res, 200, updatesFor(await current(), collectorId));
      }

      if (req.method === 'GET' && path === '/api/pickups') {
        const collectorId = url.searchParams.get('collectorId');
        if (!collectorId) return json(res, 400, { error: 'collectorId required' });
        return json(res, 200, pickupsFor(await current(), collectorId));
      }

      let m = path.match(/^\/api\/handovers\/(KC-[0-9A-Fa-f]{6})$/);
      if (req.method === 'GET' && m) {
        return json(res, 200, { handover: handoverByReference(await current(), m[1].toUpperCase()) });
      }

      m = path.match(/^\/api\/recyclers\/([\w-]+)\/handovers$/);
      if (req.method === 'GET' && m) {
        return json(res, 200, { handovers: handoversForRecycler(await current(), m[1]) });
      }

      m = path.match(/^\/api\/recyclers\/([\w-]+)\/requests$/);
      if (req.method === 'GET' && m) {
        return json(res, 200, { requests: pickupRequestsFor(await current(), m[1]) });
      }

      m = path.match(/^\/api\/export\/(\w+)\.(json|csv)$/);
      if (req.method === 'GET' && m) {
        const rows = exportDataset(await current(), m[1]);
        if (!rows) return json(res, 404, { error: `unknown dataset ${m[1]}`, datasets: DATASETS });
        if (m[2] === 'json') return json(res, 200, rows);
        res.writeHead(200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${m[1]}.csv"`,
        });
        return void res.end(toCsv(rows));
      }

      if (req.method === 'POST' && path === '/api/admin/reset') {
        if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) {
          return json(res, 403, { error: 'forbidden' });
        }
        await exclusive(async () => {
          const fresh = initialServerState();
          await (store.reset ? store.reset(fresh) : store.save(fresh));
          state = fresh;
        });
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: 'not found' });
    } catch (err) {
      if (err instanceof ValidationError || err instanceof SyntaxError || err instanceof BodyTooLarge) {
        return json(res, err instanceof BodyTooLarge ? 413 : 400, { error: err.message });
      }
      console.error(err);
      return json(res, 500, { error: 'internal error' });
    }
  };
}

// ---------------------------------------------------------------------------
// Dataset export — the problem statement's datasets, flattened for analysis.
// Collector IDs are pseudonymized (salted hash) so exports carry no device IDs.
// ---------------------------------------------------------------------------

export const DATASETS = ['materials', 'prices', 'recyclers', 'transactions', 'traceability', 'collectors', 'flags', 'audit'];

const pseudonym = (id: string) =>
  'C-' + createHash('sha256').update('kc-export|' + id).digest('hex').slice(0, 10);

type Row = Record<string, string | number | boolean | null | undefined>;

export function exportDataset(s: ServerState, name: string): Row[] | null {
  const lots = Object.values(s.lots);
  const txs = Object.values(s.transactions);
  const records = Object.values(s.traceability);
  switch (name) {
    case 'materials':
      return lots.map((l) => ({
        lotId: l.lotId,
        collector: pseudonym(l.collectorId),
        category: l.category,
        subCategory: l.subCategory,
        description: l.description,
        condition: l.condition,
        sourceType: l.sourceType,
        approxWeightKg: l.approxWeightKg,
        estimatedValue: l.estimatedValue,
        status: l.status,
        aiLabel: l.aiSuggestion?.label,
        aiConfidence: l.aiSuggestion?.confidence,
        aiModel: l.aiSuggestion?.model,
        createdAt: iso(l.createdAt),
        lat: l.location?.lat,
        lng: l.location?.lng,
      }));
    case 'prices':
      return s.prices.map((p) => ({
        category: p.category,
        subCategory: p.subCategory,
        location: p.location,
        date: iso(p.date),
        buyingPrice: p.buyingPrice,
        quotedPrice: p.quotedPrice,
        unit: p.unit,
        recyclerId: p.recyclerId,
        marketRangeLow: p.marketRangeLow,
        marketRangeHigh: p.marketRangeHigh,
      }));
    case 'recyclers':
      return s.recyclers.map((r) => ({
        recyclerId: r.recyclerId,
        name: r.name,
        address: r.location.address,
        lat: r.location.lat,
        lng: r.location.lng,
        materialsAccepted: r.materialsAccepted.join(' '),
        authorizationStatus: r.authorizationStatus,
        authorizationId: r.authorizationId,
        contact: r.contact,
        offeredRates: Object.entries(r.offeredRates)
          .map(([c, v]) => `${c}:${v}`)
          .join(' '),
        pickupAvailable: r.pickupAvailable,
        serviceArea: r.serviceArea,
      }));
    case 'transactions':
      return txs.map((t) => {
        const lot = s.lots[t.lotId];
        return {
          transactionId: t.transactionId,
          lotId: t.lotId,
          collector: pseudonym(t.collectorId),
          category: lot?.category,
          weightKg: lot?.approxWeightKg,
          quotedPrice: t.quotedPrice,
          finalPrice: t.finalPrice,
          recyclerId: t.recyclerId,
          collectionLat: t.collectionLocation.lat,
          collectionLng: t.collectionLocation.lng,
          handoverLat: t.handoverLocation?.lat,
          handoverLng: t.handoverLocation?.lng,
          dateTime: iso(t.dateTime),
          paymentStatus: t.paymentStatus,
          transactionStatus: t.transactionStatus,
          pickupStatus: t.pickup?.status,
          pickupRequestedAt: iso(t.pickup?.requestedAt),
          anomaly: s.flags[t.transactionId]?.reason,
        };
      });
    case 'traceability':
      return records.map((r) => ({
        lotId: r.lotId,
        handoverReference: r.handoverReference,
        handoverHash: r.handoverHash,
        weight: r.weight,
        timestamp: iso(r.timestamp),
        lat: r.location.lat,
        lng: r.location.lng,
        locationApproximate: r.locationApproximate ?? false,
        recyclerId: r.recyclerId,
        transactionId: r.transactionId,
        status: r.status,
        confirmedBy: r.recyclerConfirmation?.confirmedBy,
        confirmedAt: iso(r.recyclerConfirmation?.confirmedAt),
        transactionStatus: s.transactions[r.transactionId]?.transactionStatus,
      }));
    case 'collectors': {
      const byCollector = new Map<string, Row>();
      for (const l of lots) {
        const row = byCollector.get(l.collectorId) ?? {
          collector: pseudonym(l.collectorId),
          lots: 0,
          transactions: 0,
          earningsSettled: 0,
          duesPending: 0,
        };
        row.lots = (row.lots as number) + 1;
        byCollector.set(l.collectorId, row);
      }
      for (const t of txs) {
        const row = byCollector.get(t.collectorId);
        if (!row) continue;
        row.transactions = (row.transactions as number) + 1;
        const amount = t.finalPrice ?? t.quotedPrice;
        if (t.paymentStatus !== 'pending') row.earningsSettled = (row.earningsSettled as number) + amount;
        else if (t.transactionStatus !== 'pending') row.duesPending = (row.duesPending as number) + amount;
      }
      return [...byCollector.values()];
    }
    case 'flags':
      return Object.values(s.flags).map((f) => ({ ...f, at: iso(f.at) }));
    case 'audit':
      return s.audit.map((a) => ({ ...a, at: iso(a.at) }));
    default:
      return null;
  }
}

const iso = (ms?: number) => (ms == null ? undefined : new Date(ms).toISOString());

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: Row[string]) => {
    if (v == null) return '';
    const str = String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class BodyTooLarge extends Error {
  constructor() {
    super('request body too large');
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new BodyTooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return JSON.parse((await readBody(req, MAX_BODY_BYTES)).toString('utf8') || 'null');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function send(res: ServerResponse, status: number): void {
  res.writeHead(status);
  res.end();
}
