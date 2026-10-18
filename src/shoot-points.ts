const KEY = 'geuttae-shoot-points-v1';

export interface ShootPoint {
  id: string;
  region: string;
  name: string;
  lat: number;
  lng: number;
  savedAt: string;
}

export function loadShootPoints(region: string): ShootPoint[] {
  return readAll().filter((point) => point.region === region);
}

export function addShootPoint(point: ShootPoint): ShootPoint[] {
  const next = [...readAll().filter((item) => item.id !== point.id), point];
  writeAll(next);
  return next.filter((item) => item.region === point.region);
}

export function removeShootPoint(region: string, id: string): ShootPoint[] {
  const next = readAll().filter((item) => item.id !== id);
  writeAll(next);
  return next.filter((item) => item.region === region);
}

function readAll(): ShootPoint[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isShootPoint);
  } catch {
    return [];
  }
}

function writeAll(points: ShootPoint[]): void {
  storage()?.setItem(KEY, JSON.stringify(points));
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isShootPoint(value: unknown): value is ShootPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<ShootPoint>;
  return (
    typeof point.id === 'string' &&
    typeof point.region === 'string' &&
    typeof point.name === 'string' &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    typeof point.savedAt === 'string'
  );
}
