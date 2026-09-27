/**
 * System notifications for pickup updates. Shown through the service worker
 * (required on Android Chrome), so they appear while the app is open or in
 * the background. Not delivered when the app is fully closed — that needs Web
 * Push with a push service, which this prototype doesn't have.
 * Always fails silently: the in-app status is the source of truth.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function notify(title: string, body: string, tag?: string): Promise<void> {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg' });
    else new Notification(title, { body, tag });
    navigator.vibrate?.(200);
  } catch {
    // ignore — notifications are a bonus
  }
}
