import type { LatLng, MaterialLot, Recycler } from '../data/models';
import { DEFAULT_ORIGIN, haversineKm } from './geo';

export const RANK_WEIGHTS = { rate: 0.5, proximity: 0.3, pickup: 0.2 } as const;

/** Distances below this are treated as equal so a recycler 50 m away doesn't dominate. */
const MIN_DISTANCE_KM = 0.5;

export interface RankedRecycler {
  recycler: Recycler;
  score: number;
  distanceKm: number;
  offeredRate: number;
}

/** Authorized recyclers that accept the lot's category. */
export function eligibleRecyclers(lot: Pick<MaterialLot, 'category'>, recyclers: Recycler[]): Recycler[] {
  return recyclers.filter(
    (r) =>
      r.authorizationStatus === 'authorized' &&
      r.materialsAccepted.includes(lot.category) &&
      (r.offeredRates[lot.category] ?? 0) > 0,
  );
}

/**
 * score = normalized(offeredRate) * 0.5 + normalized(1/distance) * 0.3 + (pickupAvailable ? 0.2 : 0)
 * Normalization divides by the best value among eligible recyclers, so the top
 * rate and the nearest recycler each get 1.0 on their component.
 */
export function scoreRecyclers(
  lot: Pick<MaterialLot, 'category' | 'location'>,
  recyclers: Recycler[],
  origin: LatLng = lot.location ?? DEFAULT_ORIGIN,
): RankedRecycler[] {
  const candidates = eligibleRecyclers(lot, recyclers).map((recycler) => ({
    recycler,
    offeredRate: recycler.offeredRates[lot.category] ?? 0,
    distanceKm: haversineKm(origin, recycler.location),
  }));
  if (candidates.length === 0) return [];

  const maxRate = Math.max(...candidates.map((c) => c.offeredRate));
  const proximity = (km: number) => 1 / Math.max(km, MIN_DISTANCE_KM);
  const maxProximity = Math.max(...candidates.map((c) => proximity(c.distanceKm)));

  return candidates
    .map((c) => ({
      ...c,
      score:
        (c.offeredRate / maxRate) * RANK_WEIGHTS.rate +
        (proximity(c.distanceKm) / maxProximity) * RANK_WEIGHTS.proximity +
        (c.recycler.pickupAvailable ? RANK_WEIGHTS.pickup : 0),
    }))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
}

export function rankRecyclers(lot: MaterialLot, recyclers: Recycler[]): Recycler[] {
  return scoreRecyclers(lot, recyclers).map((r) => r.recycler);
}
