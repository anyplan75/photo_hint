const KEY = 'geuttae-saved-shots-v1';

export interface SavedShot {
  shotId: string;
  savedAt: string;
}

export function loadSaved(): SavedShot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedShot);
  } catch {
    return [];
  }
}

export function writeSaved(shots: SavedShot[]): void {
  localStorage.setItem(KEY, JSON.stringify(shots));
}

function isSavedShot(value: unknown): value is SavedShot {
  if (!value || typeof value !== 'object') return false;
  const shot = value as { shotId?: unknown; savedAt?: unknown };
  return typeof shot.shotId === 'string' && typeof shot.savedAt === 'string';
}
