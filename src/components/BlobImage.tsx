import { useEffect, useState } from 'react';
import materialPlaceholder from '../assets/material-placeholder.svg';

/** Renders a Blob from IndexedDB, managing the object URL lifecycle. */
export function BlobImage({ blob, alt, className }: { blob?: Blob; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  // Generated demo/skip-photo SVGs are placeholders, not camera captures.
  return <img src={blob?.type === 'image/svg+xml' ? materialPlaceholder : url} alt={alt} className={className} />;
}
