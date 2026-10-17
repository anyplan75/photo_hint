import type { SceneChoice } from './region-places';
import type { SourceId } from './sources';
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

const FAVORITES_KEY = 'geuttae-favorites-v1';

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  savedAt: string;
}

export function loadFavorites(): FavoritePlace[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavorite);
  } catch {
    return [];
  }
}

export function writeFavorites(places: FavoritePlace[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(places));
}

function isFavorite(value: unknown): value is FavoritePlace {
  if (!value || typeof value !== 'object') return false;
  const place = value as Partial<FavoritePlace>;
  return (
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.address === 'string' &&
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    typeof place.savedAt === 'string'
  );
}

const REGION_KEY = 'geuttae-region-v1';

export interface StoredRegion {
  name: string;
  label: string;
  lat: number | null;
  lng: number | null;
  south: number | null;
  north: number | null;
  west: number | null;
  east: number | null;
  savedAt: string;
}

export function loadRegion(): StoredRegion | null {
  try {
    const raw = localStorage.getItem(REGION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRegion(parsed)) return null;
    return {
      ...parsed,
      south: parsed.south ?? null,
      north: parsed.north ?? null,
      west: parsed.west ?? null,
      east: parsed.east ?? null,
    };
  } catch {
    return null;
  }
}

export function writeRegion(region: StoredRegion): void {
  localStorage.setItem(REGION_KEY, JSON.stringify(region));
}

const REFERENCES_KEY = 'geuttae-references-v1';

export interface StoredReference {
  id: string;
  url: string;
  source: SourceId;
  addedAt: string;
  sceneChoice?: SceneChoice;
}

export function loadReferences(): StoredReference[] {
  try {
    const raw = localStorage.getItem(REFERENCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReference);
  } catch {
    return [];
  }
}

export function writeReferences(items: StoredReference[]): void {
  localStorage.setItem(REFERENCES_KEY, JSON.stringify(items));
}

function isRegion(value: unknown): value is StoredRegion {
  if (!value || typeof value !== 'object') return false;
  const region = value as Partial<StoredRegion>;
  return (
    typeof region.name === 'string' &&
    typeof region.label === 'string' &&
    (typeof region.lat === 'number' || region.lat === null) &&
    (typeof region.lng === 'number' || region.lng === null) &&
    typeof region.savedAt === 'string'
  );
}

function isReference(value: unknown): value is StoredReference {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredReference>;
  return typeof item.id === 'string' && typeof item.url === 'string' && typeof item.source === 'string' && typeof item.addedAt === 'string';
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
