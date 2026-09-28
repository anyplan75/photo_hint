const sent = new Set<string>();

export type NotifyPermission = NotificationPermission | 'unsupported';

export function readPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function askPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

export async function registerWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch {
    // Notification still falls back to the page constructor.
  }
}

export async function notifyOnce(key: string, title: string, body: string): Promise<void> {
  if (sent.has(key)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  sent.add(key);
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration && 'showNotification' in registration) {
      await registration.showNotification(title, { body, tag: key, lang: 'ko' });
      return;
    }
  } catch {
    // Fall through to the page notification.
  }
  try {
    new Notification(title, { body, tag: key, lang: 'ko' });
  } catch {
    sent.delete(key);
  }
}
