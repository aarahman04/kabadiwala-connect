import type { TrendPoint } from '../logic/valuation';

interface Props {
  points: TrendPoint[];
  width?: number;
  height?: number;
  className?: string;
}

/** Minimal SVG sparkline; colour comes from `currentColor`. */
export function Sparkline({ points, width = 160, height = 40, className }: Props) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.date);
  const ys = points.map((p) => p.price);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const pad = 3;
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad * 2);
  const sy = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.date).toFixed(1)},${sy(p.price).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg
      className={`sparkline ${className ?? ''}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(last.date)} cy={sy(last.price)} r="3" fill="currentColor" />
    </svg>
  );
}
