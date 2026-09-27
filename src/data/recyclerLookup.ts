/**
 * Recycler-side data access: find and verify a handover code, sanity-check the
 * final price, list incoming handovers, publish buying rates.
 */
import { getDB, getSetting, notifyChange, setSetting } from './db';
import { recyclerConfirm } from './actions';
import { requestSync, runSync } from './syncRunner';
import type { ConfirmationPayload, LatLng, MaterialCategory, PickupStatus, Recycler, TraceabilityRecord } from './models';
import * as api from '../services/api';
import { transactionAnomaly, type TransactionFlag } from '../services/serverCore';
import { normalizeReference, verifyHandover } from '../logic/hashing';
import { priceBoardRow } from '../logic/valuation';
import type { HandoverLookup } from '../screens/RecyclerConfirm';

function verify(record: Omit<TraceabilityRecord, 'photoBlobs'>): Promise<boolean> {
  return verifyHandover(
    {
      lotId: record.lotId,
      weight: record.weight,
      timestamp: record.timestamp,
      location: record.location,
      collectorId: record.collectorId,
      recyclerId: record.recyclerId,
    },
    record,
  );
}

/**
 * Finds a handover code: this device first (same-phone demo, works offline),
 * then the server. Re-derives the SHA-256 from the record's fields so the
 * recycler can see the record hasn't been tampered with.
 */
export async function lookupHandover(code: string): Promise<HandoverLookup> {
  const reference = normalizeReference(code);
  const db = await getDB();
  const local = await db.getFromIndex('traceability', 'byReference', reference);
  if (local) {
    const [lot, transaction, recycler] = await Promise.all([
      db.get('materials', local.lotId),
      db.get('transactions', local.transactionId),
      db.get('recyclers', local.recyclerId),
    ]);
    const confirmedHere = await confirmationQueued(reference);
    return {
      reference,
      source: 'local',
      recyclerId: local.recyclerId,
      category: lot?.category,
      weight: local.weight,
      quotedPrice: transaction?.quotedPrice,
      timestamp: local.timestamp,
      photos: local.photoBlobs,
      hashValid: await verify(local),
      recyclerName: recycler?.name,
      alreadyConfirmed: local.status === 'confirmed' || confirmedHere,
    };
  }

  if (api.isOnline()) {
    try {
      const remote = await api.lookupHandover(reference);
      if (remote) {
        const recycler = await db.get('recyclers', remote.record.recyclerId);
        return {
          reference,
          source: 'server',
          recyclerId: remote.record.recyclerId,
          category: remote.lot?.category,
          weight: remote.record.weight,
          quotedPrice: remote.transaction?.quotedPrice,
          timestamp: remote.record.timestamp,
          thumbnails: remote.record.photoThumbnails,
          hashValid: await verify(remote.record),
          recyclerName: recycler?.name,
          alreadyConfirmed: remote.record.status === 'confirmed' || (await confirmationQueued(reference)),
        };
      }
    } catch {
      // fall through to "not found" — confirmation can still be queued
    }
  }
  return { reference, source: 'none', alreadyConfirmed: await confirmationQueued(reference) };
}

async function confirmationQueued(reference: string): Promise<boolean> {
  const queue = await (await getDB()).getAll('syncQueue');
  return queue.some((q) => q.op.kind === 'confirmHandover' && q.op.confirmation.handoverReference === reference);
}

export async function submitConfirmation(confirmation: ConfirmationPayload): Promise<'sent' | 'queued'> {
  await recyclerConfirm(confirmation);
  if (!api.isOnline()) return 'queued';
  await runSync();
  return (await confirmationQueued(confirmation.handoverReference)) ? 'queued' : 'sent';
}

/** Same rule the server applies: abnormal vs market band, or far from the quote. */
export async function checkFinalPrice(
  lookup: Pick<HandoverLookup, 'reference' | 'category' | 'weight' | 'quotedPrice'>,
  finalPrice: number,
): Promise<Pick<TransactionFlag, 'reason' | 'deviationPct'> | null> {
  if (!(finalPrice > 0) || !lookup.weight) return null;
  const prices = await (await getDB()).getAll('prices');
  const band = lookup.category ? priceBoardRow(prices, lookup.category) : undefined;
  return transactionAnomaly(
    { transactionId: lookup.reference, quotedPrice: lookup.quotedPrice ?? 0, finalPrice },
    lookup.weight,
    band?.marketRangeLow,
    band?.marketRangeHigh,
  );
}

// ---------------------------------------------------------------------------
// Recycler identity, worklist, rates
// ---------------------------------------------------------------------------

export const getRecyclerIdentity = () => getSetting<string>('recyclerId');
export const setRecyclerIdentity = (id: string) => setSetting('recyclerId', id);

export interface IncomingHandover {
  reference: string;
  category?: MaterialCategory;
  weight: number;
  quotedPrice?: number;
  timestamp: number;
  confirmed: boolean;
  thumbnail?: string;
}

/** Handovers addressed to this recycler, from the server. Null when offline. */
export async function loadIncoming(recyclerId: string): Promise<IncomingHandover[] | null> {
  if (!api.isOnline()) return null;
  try {
    const list = await api.fetchRecyclerHandovers(recyclerId);
    return list.map((h) => ({
      reference: h.record.handoverReference,
      category: h.lot?.category,
      weight: h.record.weight,
      quotedPrice: h.transaction?.quotedPrice,
      timestamp: h.record.timestamp,
      confirmed: h.record.status === 'confirmed',
      thumbnail: h.record.photoThumbnails?.[0],
    }));
  } catch {
    return null;
  }
}

/** Publish new buying rates: applied locally now, queued for the server. */
export async function saveRecyclerRates(
  recyclerId: string,
  offeredRates: Partial<Record<MaterialCategory, number>>,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['recyclers', 'syncQueue'], 'readwrite');
  const recycler = (await tx.objectStore('recyclers').get(recyclerId)) as Recycler | undefined;
  if (!recycler) throw new Error(`unknown recycler ${recyclerId}`);
  const materials = new Set(recycler.materialsAccepted);
  for (const c of Object.keys(offeredRates) as MaterialCategory[]) materials.add(c);
  await tx.objectStore('recyclers').put({
    ...recycler,
    offeredRates: { ...recycler.offeredRates, ...offeredRates },
    materialsAccepted: [...materials],
  });
  await tx.objectStore('syncQueue').add({
    op: { kind: 'updateRecyclerRates', recyclerId, offeredRates, at: Date.now() },
    createdAt: Date.now(),
    attempts: 0,
  });
  await tx.done;
  notifyChange('recyclers', 'syncQueue');
  requestSync();
}

export interface PickupInboxItem {
  transactionId: string;
  status: PickupStatus;
  requestedAt: number;
  category?: MaterialCategory;
  weight?: number;
  quotedPrice: number;
  location: LatLng; // where the collector is
  contactPhone?: string;
  thumbnail?: string;
}

/** Open pickup requests for this facility, from the server. Null when offline. */
export async function loadPickupRequests(recyclerId: string): Promise<PickupInboxItem[] | null> {
  if (!api.isOnline()) return null;
  try {
    const list = await api.fetchPickupRequests(recyclerId);
    return list.map(({ transaction: t, lot }) => ({
      transactionId: t.transactionId,
      status: t.pickup!.status,
      requestedAt: t.pickup!.requestedAt,
      category: lot?.category,
      weight: lot?.approxWeightKg,
      quotedPrice: t.quotedPrice,
      location: t.collectionLocation,
      contactPhone: t.pickup!.contactPhone,
      thumbnail: lot?.photoThumbnail,
    }));
  } catch {
    return null;
  }
}
