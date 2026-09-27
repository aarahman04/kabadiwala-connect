export function SafetyPictogram({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width="96"
      height="96"
      className={`safety-pictogram safety-${kind}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="43" fill="currentColor" opacity=".05" stroke="none" />
      {kind === 'fire' && (
        <>
          <path d="M49 20c4 14 17 17 17 30a18 18 0 0 1-36 0c0-9 8-17 11-21 0 11 3 12 5 14 4-7 5-13 3-23Z" />
          <path d="M23 72h44c8 0 8 9 0 9H37m-9-5v10m-6-8h6" />
        </>
      )}
      {kind === 'battery' && (
        <>
          <rect x="31" y="26" width="34" height="47" rx="4" />
          <path d="M40 26v-7h16v7m-8 13-7 13h13l-7 13M69 26l8-9m-2 20h8" />
        </>
      )}
      {kind === 'crt' && (
        <>
          <path d="M21 31h54v39H21Zm7 6h31v24H28Zm11 33v7h22M64 40h5m-5 10h5M34 22l12 9 12-9" />
          <path d="m36 42 8 5-6 7 10 3" />
        </>
      )}
      {kind === 'acid' && (
        <>
          <path d="m28 19 28 11-9 21-18-7Zm2 1-7-2m28 10 9 3M59 51c-8 11-8 13 0 16 8-3 8-5 0-16ZM20 71h56v10H20Zm9 0v10m11-10v10m11-10v10" />
        </>
      )}
      {kind === 'protection' && (
        <>
          <path d="M16 56V39c0-5 6-5 6 0V27c0-5 6-5 6 0v10-15c0-5 6-5 6 0v15-11c0-5 6-5 6 0v24l5-7c3-4 8 0 5 4L40 65v10H23V65Z" />
          <path d="m57 43 14-5 14 5v15c-2 7-7 12-14 15-7-3-12-8-14-15Zm0 2c-9 0-9 13 0 13m28-13c9 0 9 13 0 13M63 48h16m-16 7h16m-13 7h10" />
        </>
      )}
      {kind !== 'protection' && (
        <g stroke="#b04435">
          <circle cx="48" cy="48" r="41" />
          <path d="m19 19 58 58" strokeWidth="5" />
        </g>
      )}
    </svg>
  );
}
