import type { MaterialCategory, PriceEntry } from '../data/models';
import { MATERIAL_CATEGORIES } from '../data/models';

/** Market entries within this window of the latest one are averaged into the board price. */
const BOARD_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface PriceBoardRow {
  category: MaterialCategory;
  pricePerUnit: number; // ₹ per `unit`
  unit: 'kg' | 'unit';
  marketRangeLow: number;
  marketRangeHigh: number;
  asOf: number;
  changePct: number; // over the whole available history
}

export type PriceBoard = Partial<Record<MaterialCategory, PriceBoardRow>>;

/** Market-wide observations only (recycler quotes are excluded from the board). */
function marketEntries(prices: PriceEntry[], category: MaterialCategory): PriceEntry[] {
  return prices.filter((p) => p.category === category && !p.recyclerId).sort((a, b) => a.date - b.date);
}

export interface TrendPoint {
  date: number;
  price: number;
}

export function priceTrend(prices: PriceEntry[], category: MaterialCategory): TrendPoint[] {
  return marketEntries(prices, category).map((p) => ({ date: p.date, price: p.buyingPrice }));
}

export function trendChangePct(points: TrendPoint[]): number {
  if (points.length < 2 || points[0].price === 0) return 0;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  return ((last - first) / first) * 100;
}

export function priceBoardRow(prices: PriceEntry[], category: MaterialCategory): PriceBoardRow | undefined {
  const entries = marketEntries(prices, category);
  if (entries.length === 0) return undefined;
  const latest = entries[entries.length - 1];
  const recent = entries.filter((e) => latest.date - e.date <= BOARD_WINDOW_MS);
  const avg = recent.reduce((sum, e) => sum + e.buyingPrice, 0) / recent.length;
  return {
    category,
    pricePerUnit: Math.round(avg * 100) / 100,
    unit: latest.unit,
    marketRangeLow: latest.marketRangeLow,
    marketRangeHigh: latest.marketRangeHigh,
    asOf: latest.date,
    changePct: trendChangePct(priceTrend(prices, category)),
  };
}

export function buildPriceBoard(prices: PriceEntry[]): PriceBoard {
  const board: PriceBoard = {};
  for (const category of MATERIAL_CATEGORIES) {
    const row = priceBoardRow(prices, category);
    if (row) board[category] = row;
  }
  return board;
}

/** Estimated lot value in whole rupees. */
export function valueLot(weightKg: number, row: Pick<PriceBoardRow, 'pricePerUnit'> | undefined): number {
  if (!row || !(weightKg > 0)) return 0;
  return Math.round(weightKg * row.pricePerUnit);
}

/** Value range the collector should expect, from the market low/high. */
export function valueRange(weightKg: number, row: PriceBoardRow | undefined): { low: number; high: number } {
  if (!row || !(weightKg > 0)) return { low: 0, high: 0 };
  return { low: Math.round(weightKg * row.marketRangeLow), high: Math.round(weightKg * row.marketRangeHigh) };
}
