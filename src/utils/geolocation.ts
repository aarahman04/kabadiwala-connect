import type { LatLng } from '../data/models';
import { DEFAULT_ORIGIN } from '../logic/geo';

const LAST_POSITION_KEY = 'kc-last-position';

export interface PositionResult {
  location: LatLng;
  approximate: boolean;
}

/**
 * GPS works without network (GNSS), but can be slow indoors. Falls back to the
 * last good fix, then the city centre, flagging the result as approximate.
 */
export function getPosition(timeoutMs = 8000): Promise<PositionResult> {
  return new Promise((resolve) => {
    const fallback = (): PositionResult => {
      try {
        const saved = localStorage.getItem(LAST_POSITION_KEY);
        if (saved) return { location: JSON.parse(saved) as LatLng, approximate: true };
      } catch {
        // ignore
      }
      return { location: DEFAULT_ORIGIN, approximate: true };
    };
    if (!('geolocation' in navigator)) return resolve(fallback());
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          localStorage.setItem(LAST_POSITION_KEY, JSON.stringify(location));
        } catch {
          // ignore
        }
        resolve({ location, approximate: false });
      },
      () => resolve(fallback()),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
