const KEY = 'geuttae-shoot-points-v1';
const PENDING_KEY = 'geuttae-shoot-points-pending-v1';
const SEEDED_KEY = 'geuttae-shoot-points-seeded-v1';

export interface ShootPoint {
  id: string;
  region: string;
  name: string;
  lat: number;
  lng: number;
  savedAt: string;
  note?: string;
}

export function loadShootPoints(region: string): ShootPoint[] {
  return readAll().filter((point) => point.region === region);
}

export function loadAllShootPoints(): ShootPoint[] {
  return readAll();
}

export function addShootPoint(point: ShootPoint): ShootPoint[] {
  const next = [...readAll().filter((item) => item.id !== point.id), point];
  writeAll(next);
  addPending(point.id);
  return next.filter((item) => item.region === point.region);
}

export function removeShootPoint(region: string, id: string): ShootPoint[] {
  const next = readAll().filter((item) => item.id !== id);
  writeAll(next);
  removePending(id);
  return next.filter((item) => item.region === region);
}

/** 계정에서 받은 목록을 이 브라우저에 비춥니다. 새로 올릴 대기 목록에는 넣지 않습니다. */
export function writeShootPointMirror(points: ShootPoint[]): void {
  writeAll(points.filter(isShootPoint));
}

export function isPlaceSeeded(): boolean {
  return storage()?.getItem(SEEDED_KEY) === '1';
}

export function markPlacesSeeded(): void {
  storage()?.setItem(SEEDED_KEY, '1');
}

export function readPendingPlaceIds(): string[] {
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function clearPendingPlaceIds(): void {
  storage()?.setItem(PENDING_KEY, '[]');
}

/**
 * 계정에 없는 지점만 올립니다.
 * 처음 로그인하면 이 브라우저에 있던 지점을 한 번 올립니다.
 * 그 다음부터는 로그아웃 중에 새로 만든 지점만 올립니다.
 * 서버에 있는 지점을 지우거나 덮어쓰지 않습니다.
 */
export function placesToUpload(
  local: ShootPoint[],
  serverIds: ReadonlySet<string>,
  seeded: boolean,
  pendingIds: ReadonlySet<string>,
): ShootPoint[] {
  const candidates = seeded ? local.filter((point) => pendingIds.has(point.id)) : local;
  return candidates.filter((point) => !serverIds.has(point.id));
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

function addPending(id: string): void {
  const next = new Set(readPendingPlaceIds());
  next.add(id);
  storage()?.setItem(PENDING_KEY, JSON.stringify([...next]));
}

function removePending(id: string): void {
  const next = readPendingPlaceIds().filter((item) => item !== id);
  storage()?.setItem(PENDING_KEY, JSON.stringify(next));
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
  const noteOk = point.note === undefined || typeof point.note === 'string';
  return (
    typeof point.id === 'string' &&
    typeof point.region === 'string' &&
    typeof point.name === 'string' &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    typeof point.savedAt === 'string' &&
    noteOk
  );
}
