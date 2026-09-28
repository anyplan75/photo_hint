import { distanceMeters } from './geo';

export type NearbyKind = 'viewpoint' | 'peak' | 'lake' | 'bridge' | 'park';

export interface NearbyPlace {
  id: string;
  name: string;
  kind: NearbyKind;
  lat: number;
  lng: number;
  elevationM: number;
  distanceM: number;
}

export const NEARBY_RADIUS_M = 5000;

export const KIND_LABEL: Record<NearbyKind, string> = {
  viewpoint: '전망',
  peak: '봉우리',
  lake: '호수',
  bridge: '다리',
  park: '공원',
};

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const KIND_CAP = 2;
const MAX_PLACES = 6;

export async function loadNearby(lat: number, lng: number, signal: AbortSignal): Promise<NearbyPlace[]> {
  const query = nearbyQuery(lat, lng, NEARBY_RADIUS_M);
  let lastError: unknown;
  for (const [index, endpoint] of ENDPOINTS.entries()) {
    try {
      const elements = await fetchElements(endpoint, query, signal);
      return selectNearby(lat, lng, elements, NEARBY_RADIUS_M);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
      if (index < ENDPOINTS.length - 1) await pause(600, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('nearby lookup failed');
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export function selectNearby(
  lat: number,
  lng: number,
  elements: OverpassElement[],
  radiusM = NEARBY_RADIUS_M,
): NearbyPlace[] {
  const closest = new Map<string, NearbyPlace>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const kind = classify(tags);
    const name = placeName(tags);
    const point = pointOf(element);
    if (!kind || !name || !point || element.id == null || !element.type) continue;
    const distanceM = distanceMeters(lat, lng, point.lat, point.lng);
    if (distanceM > radiusM) continue;
    const place: NearbyPlace = {
      id: `${element.type}/${element.id}`,
      name,
      kind,
      lat: point.lat,
      lng: point.lng,
      elevationM: elevationOf(tags),
      distanceM,
    };
    const key = `${kind}:${name}`;
    const previous = closest.get(key);
    if (!previous || place.distanceM < previous.distanceM) closest.set(key, place);
  }

  const ranked = [...closest.values()].sort((a, b) => a.distanceM - b.distanceM);
  const priority: NearbyKind[] = ['viewpoint', 'lake', 'peak', 'park', 'bridge'];
  const buckets = new Map<NearbyKind, NearbyPlace[]>(priority.map((kind) => [kind, []]));
  for (const place of ranked) buckets.get(place.kind)?.push(place);
  const picked: NearbyPlace[] = [];
  for (let round = 0; round < KIND_CAP && picked.length < MAX_PLACES; round += 1) {
    for (const kind of priority) {
      const next = buckets.get(kind)?.[round];
      if (!next) continue;
      picked.push(next);
      if (picked.length >= MAX_PLACES) break;
    }
  }
  return picked.sort((a, b) => a.distanceM - b.distanceM);
}

function nearbyQuery(lat: number, lng: number, radiusM: number): string {
  const bbox = boundingBox(lat, lng, radiusM);
  return `[out:json][timeout:20];
(
  node["tourism"="viewpoint"]${bbox};
  way["tourism"="viewpoint"]${bbox};
  node["natural"="peak"]["name"]${bbox};
  way["leisure"="park"]["name"]${bbox};
  node["leisure"="park"]["name"]${bbox};
  way["water"="lake"]["name"]${bbox};
  node["water"="lake"]["name"]${bbox};
  way["natural"="water"]["name"]${bbox};
  node["natural"="water"]["name"]${bbox};
  way["bridge"="yes"]["name"]${bbox};
);
out center tags;`;
}

function boundingBox(lat: number, lng: number, radiusM: number): string {
  const latPad = radiusM / 111320;
  const lngPad = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return `(${lat - latPad},${lng - lngPad},${lat + latPad},${lng + lngPad})`;
}

async function fetchElements(endpoint: string, query: string, signal: AbortSignal): Promise<OverpassElement[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`overpass ${response.status}`);
  const payload = (await response.json()) as { elements?: OverpassElement[] };
  return Array.isArray(payload.elements) ? payload.elements : [];
}

function classify(tags: Record<string, string>): NearbyKind | null {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.natural === 'peak') return 'peak';
  if (isLake(tags)) return 'lake';
  if (tags.man_made === 'bridge' || tags.bridge === 'yes') return 'bridge';
  if (tags.leisure === 'park') return 'park';
  return null;
}

function isLake(tags: Record<string, string>): boolean {
  if (tags.water === 'river' || tags.water === 'canal' || tags.water === 'stream') return false;
  return tags.water === 'lake' || tags.water === 'pond' || tags.natural === 'water';
}

function placeName(tags: Record<string, string>): string {
  return (tags['name:ko'] || tags.name || '').trim();
}

function pointOf(element: OverpassElement): { lat: number; lng: number } | null {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lng: element.lon };
  }
  if (typeof element.center?.lat === 'number' && typeof element.center.lon === 'number') {
    return { lat: element.center.lat, lng: element.center.lon };
  }
  return null;
}

function elevationOf(tags: Record<string, string>): number {
  const value = Number(tags.ele);
  return Number.isFinite(value) ? value : 0;
}
