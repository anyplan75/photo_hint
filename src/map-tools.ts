import { mapboxPublicToken } from './mapbox-token';

/**
 * 바로낚시 `PlaceNameClient` 와 같은 맵박스 주소입니다.
 * 주소 검색은 `forward` / `hits` 를 그대로 따릅니다.
 * 길 맞추기와 경로 안내는 바로낚시에 함수가 없고, 그 앱이 이미 쓰는 맵박스만 사용합니다.
 */

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface AddressHit {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
}

export interface SnappedPoint extends MapPoint {
  road: string;
}

export interface RoutePath {
  coordinates: [number, number][];
  summary: string;
}

export interface RoadOverlay {
  address: { lat: number; lng: number; label: string } | null;
  raw: MapPoint | null;
  snapped: MapPoint | null;
  route: [number, number][] | null;
  frame: number;
}

export const emptyRoad: RoadOverlay = {
  address: null,
  raw: null,
  snapped: null,
  route: null,
  frame: 0,
};

/** 바로낚시 `PlaceNameClient.forward` 와 같습니다. 주소 글을 지도 좌표로 바꿉니다. */
export async function forwardAddress(
  query: string,
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<AddressHit[]> {
  const token = mapboxPublicToken();
  const trimmed = query.trim();
  if (!token || !trimmed) return [];
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('language', 'ko');
  url.searchParams.set('limit', '5');
  url.searchParams.set('proximity', `${longitude},${latitude}`);
  url.searchParams.set('access_token', token);
  const payload = await readJson(url, signal);
  return readHits(payload);
}

/** 바로낚시 `PlaceNameClient.hits` 와 같습니다. 좌표가 없는 결과는 버립니다. */
function readHits(payload: unknown): AddressHit[] {
  const features = asRecord(payload)?.features;
  if (!Array.isArray(features)) return [];
  const hits: AddressHit[] = [];
  for (const feature of features) {
    const record = asRecord(feature);
    const properties = asRecord(record?.properties) ?? {};
    const geometry = asRecord(record?.geometry) ?? {};
    const coordinates = geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const name = text(properties.name) || text(properties.full_address) || '이름 없는 장소';
    const full = text(properties.full_address);
    const id = text(properties.mapbox_id) || name;
    hits.push({
      id,
      name,
      label: full || name,
      lat: latitude,
      lng: longitude,
    });
  }
  return hits;
}

/**
 * 흔들리는 점 하나를 길 위에 붙입니다.
 * 맵박스 길 맞추기는 점이 두 개부터라서, 같은 점 바로 북쪽에 짧은 점을 하나 더 보냅니다.
 * 화면에 붙이는 자리는 처음 점의 결과입니다.
 * 흔들림 범위(50m) 안에 길이 없으면, 같은 맵박스 경로 계산으로 가장 가까운 길에 붙입니다.
 */
export async function matchToRoad(point: MapPoint, signal: AbortSignal): Promise<SnappedPoint | null> {
  const token = mapboxPublicToken();
  if (!token) return null;
  const next = offsetNorth(point, 12);
  const coordinates = `${formatPair(point)};${formatPair(next)}`;
  for (const profile of ['driving', 'walking']) {
    const url = new URL(`https://api.mapbox.com/matching/v5/mapbox/${profile}/${coordinates}.json`);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('tidy', 'true');
    url.searchParams.set('radiuses', '50;50');
    url.searchParams.set('access_token', token);
    const payload = await readJson(url, signal);
    const snapped = firstTracepoint(payload);
    if (snapped) return snapped;
  }
  for (const profile of ['driving', 'walking']) {
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'simplified');
    url.searchParams.set('radiuses', 'unlimited;unlimited');
    url.searchParams.set('access_token', token);
    const payload = await readJson(url, signal);
    const snapped = firstWaypoint(payload);
    if (snapped) return snapped;
  }
  return null;
}

export function movedMeters(from: MapPoint, to: MapPoint): number {
  const lat = (from.lat - to.lat) * 111320;
  const lng = (from.lng - to.lng) * 111320 * Math.cos((from.lat * Math.PI) / 180);
  return Math.hypot(lat, lng);
}

/** 두 좌표 사이 길을 계산합니다. 차도를 먼저 보고, 없으면 걷는 길로 다시 계산합니다. */
export async function routeBetween(start: MapPoint, end: MapPoint, signal: AbortSignal): Promise<RoutePath | null> {
  const token = mapboxPublicToken();
  if (!token) return null;
  const coordinates = `${formatPair(start)};${formatPair(end)}`;
  for (const profile of ['driving', 'walking']) {
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('language', 'ko');
    url.searchParams.set('access_token', token);
    const payload = await readJson(url, signal);
    const path = readRoute(payload);
    if (path) return path;
  }
  return null;
}

export function formatRoute(distanceMeters: number, durationSeconds: number): string {
  const distance = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)}km` : `${Math.round(distanceMeters)}m`;
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${distance}, 약 ${minutes}분`;
}

/** 지도 가운데와 너무 먼 기기 위치는 이 지도의 점이 아닙니다. */
export function farFromMap(point: MapPoint, center: MapPoint): boolean {
  const latKm = (point.lat - center.lat) * 111;
  const lngKm = (point.lng - center.lng) * 111 * Math.cos((center.lat * Math.PI) / 180);
  return Math.hypot(latKm, lngKm) > 40;
}

function firstWaypoint(payload: unknown): SnappedPoint | null {
  const record = asRecord(payload);
  if (record?.code !== 'Ok' || !Array.isArray(record.waypoints)) return null;
  const waypoint = asRecord(record.waypoints[0]);
  const location = waypoint?.location;
  if (!Array.isArray(location) || location.length < 2) return null;
  const lng = Number(location[0]);
  const lat = Number(location[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, road: text(waypoint?.name) };
}

function firstTracepoint(payload: unknown): SnappedPoint | null {
  const record = asRecord(payload);
  if (record?.code !== 'Ok' || !Array.isArray(record.tracepoints)) return null;
  for (const item of record.tracepoints) {
    const trace = asRecord(item);
    const location = trace?.location;
    if (!Array.isArray(location) || location.length < 2) continue;
    const lng = Number(location[0]);
    const lat = Number(location[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { lat, lng, road: text(trace?.name) };
  }
  return null;
}

function readRoute(payload: unknown): RoutePath | null {
  const record = asRecord(payload);
  if (record?.code !== 'Ok' || !Array.isArray(record.routes)) return null;
  const route = asRecord(record.routes[0]);
  const geometry = asRecord(route?.geometry);
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const line: [number, number][] = [];
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    line.push([lng, lat]);
  }
  if (line.length < 2) return null;
  const distance = Number(route?.distance);
  const duration = Number(route?.duration);
  return {
    coordinates: line,
    summary: formatRoute(Number.isFinite(distance) ? distance : 0, Number.isFinite(duration) ? duration : 0),
  };
}

async function readJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  return response.json();
}

function offsetNorth(point: MapPoint, meters: number): MapPoint {
  return { lat: point.lat + meters / 111320, lng: point.lng };
}

function formatPair(point: MapPoint): string {
  return `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
