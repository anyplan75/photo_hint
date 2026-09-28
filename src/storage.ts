import type { WindowKind } from './places';

const KEY = 'geuttae-saved-shots-v2';

export interface SavedShot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  title: string;
  window: WindowKind;
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
  const shot = value as Partial<SavedShot>;
  return (
    typeof shot.id === 'string' &&
    typeof shot.name === 'string' &&
    typeof shot.lat === 'number' &&
    typeof shot.lng === 'number' &&
    typeof shot.elevationM === 'number' &&
    typeof shot.title === 'string' &&
    typeof shot.window === 'string' &&
    typeof shot.savedAt === 'string'
  );
}
