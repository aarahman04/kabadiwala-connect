/** Deviation beyond the market band (as a fraction of the band edge) that triggers a warning. */
export const ANOMALY_THRESHOLD = 0.4;

export interface PriceAnomaly {
  flagged: boolean;
  direction: 'below' | 'above' | 'within';
  deviationPct: number; // how far outside the band, 0 when within
}

/**
 * Flags a quote that sits more than 40% below the market low or above the
 * market high. Rule-based today; this is the hook where a learned model of
 * fair price per category/area/season would plug in.
 */
export function detectPriceAnomaly(
  quoted: number,
  marketRangeLow: number,
  marketRangeHigh: number,
  threshold = ANOMALY_THRESHOLD,
): PriceAnomaly {
  if (quoted < marketRangeLow && marketRangeLow > 0) {
    const deviation = (marketRangeLow - quoted) / marketRangeLow;
    return { flagged: deviation > threshold, direction: 'below', deviationPct: Math.round(deviation * 100) };
  }
  if (quoted > marketRangeHigh && marketRangeHigh > 0) {
    const deviation = (quoted - marketRangeHigh) / marketRangeHigh;
    return { flagged: deviation > threshold, direction: 'above', deviationPct: Math.round(deviation * 100) };
  }
  return { flagged: false, direction: 'within', deviationPct: 0 };
}
