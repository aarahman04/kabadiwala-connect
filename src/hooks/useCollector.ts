import { useEffect, useState } from 'react';
import type { CollectorProfile } from '../data/models';
import { ensureSeeded } from '../data/seed';

/** Creates the local collector + seed data on first launch. */
export function useCollector() {
  const [profile, setProfile] = useState<CollectorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ensureSeeded().then(setProfile, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return { profile, error };
}
