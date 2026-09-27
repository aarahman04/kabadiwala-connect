import type { MaterialCategory } from '../../data/models';

// Distinct silhouettes at the same 24 px scale as the interface icons.
const paths: Record<MaterialCategory, React.ReactNode> = {
  CRT: (
    <>
      <path d="M5 4h14l2 3v12H3V7Z" />
      <rect x="6" y="7" width="10" height="8" rx="2" />
      <path d="M18 9v1m0 3v1M8 22v-3m8 3v-3" />
    </>
  ),
  LCD_PANEL: (
    <>
      <rect x="2" y="3" width="20" height="13" rx="1.5" />
      <path d="M12 16v5m-5 0h10M5 13h14" />
    </>
  ),
  PCB: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <rect x="8" y="7" width="6" height="7" rx="1" />
      <path d="M11 3v4m3 7v4h6M4 10h4m-4 7h4v-3m6-4h6m-9 4v7" />
      <circle cx="17" cy="6" r=".7" />
    </>
  ),
  CABLE: (
    <>
      <path d="M5 2v4m4-4v4M3 6h8v3a4 4 0 0 1-8 0Zm4 7v4a4 4 0 0 0 8 0v-4m-2-6h4v6h-4Zm2-5v5" />
    </>
  ),
  BATTERY: (
    <>
      <rect x="5" y="5" width="14" height="17" rx="2" />
      <path d="M9 5V2h6v3M9 10h6m-3-3v6m-3 5h6" />
    </>
  ),
  MOTOR_MAGNET: (
    <>
      <path d="M5 3v10a7 7 0 0 0 14 0V3h-5v10a2 2 0 0 1-4 0V3Zm0 5h5m4 0h5" />
    </>
  ),
  MIXED_PLASTIC: (
    <>
      <path d="M6 2h4v4l2 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9l2-3ZM4 12h8m-8 6h8m4-11h6l-1 14h-4Zm-1 0h8m-5-4h2" />
    </>
  ),
};
export function CategoryIcon({ category, className = '' }: { category: MaterialCategory; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`category-symbol ${className}`}
    >
      {paths[category]}
    </svg>
  );
}
