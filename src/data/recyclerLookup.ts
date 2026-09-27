import { getDB } from './db';
import { recyclerConfirm } from './actions';
import { runSync } from './syncRunner';
import type { ConfirmationPayload, TraceabilityRecord } from './models';
import * as api from '../services/api';
import { normalizeReference, verifyHandover } from '../logic/hashing';
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
          category: remote.lot?.category,
          weight: remote.record.weight,
          quotedPrice: remote.transaction?.quotedPrice,
          timestamp: remote.record.timestamp,
          hashValid: await verify(remote.record),
          recyclerName: recycler?.name,
          alreadyConfirmed: remote.record.status === 'confirmed',
        };
      }
    } catch {
      // fall through to "not found" — confirmation can still be queued
    }
  }
  return { reference, source: 'none' };
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
