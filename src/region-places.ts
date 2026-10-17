export type SpotKind = 'coast' | 'oreum' | 'harbor' | 'field' | 'cliff' | 'street';

export type SceneChoice = '바다' | '오름' | '거리' | '사람' | '밤' | '들판' | '절벽' | '항구';

export const FALLBACK_SCENES: SceneChoice[] = ['바다', '오름', '거리', '사람', '밤'];

export interface Spot {
  kind: SpotKind;
  name: string;
  lat: number;
  lng: number;
  osm: string;
  /** Direction from the island's oreum centroid toward this shore, degrees from north. */
  seaward?: number;
}

/**
 * Named places returned by Overpass (overpass.openstreetmap.fr) on 2026-10-17
 * for the Jeju bbox 33.19–33.57 N, 126.15–126.98 E. Seaward bearings are the
 * direction from the mean of 252 peaks whose names contain 오름 (33.390542 N, 126.556513 E).
 */
export const JEJU_SPOTS: Spot[] = [
  { kind: 'coast', name: '협재 해수욕장', lat: 33.395112, lng: 126.24028, osm: 'node/368950786', seaward: 271 },
  { kind: 'coast', name: '함덕해수욕장', lat: 33.543231, lng: 126.669858, osm: 'way/200720586', seaward: 32 },
  { kind: 'coast', name: '중문색달해수욕장', lat: 33.244851, lng: 126.410334, osm: 'way/242454273', seaward: 220 },
  { kind: 'coast', name: '이호테우해변', lat: 33.497668, lng: 126.451871, osm: 'way/289861442', seaward: 321 },
  { kind: 'coast', name: '월정리 해수욕장', lat: 33.556061, lng: 126.796849, osm: 'way/335845433', seaward: 50 },
  { kind: 'coast', name: '김녕해변', lat: 33.557629, lng: 126.759221, osm: 'way/373413305', seaward: 45 },
  { kind: 'coast', name: '표선해비치해변', lat: 33.327804, lng: 126.838648, osm: 'way/375056563', seaward: 105 },
  { kind: 'coast', name: '사계해안', lat: 33.224571, lng: 126.299346, osm: 'way/592560810', seaward: 232 },
  { kind: 'oreum', name: '금오름', lat: 33.354634, lng: 126.305825, osm: 'node/3736657966' },
  { kind: 'oreum', name: '도너리오름', lat: 33.326222, lng: 126.321229, osm: 'node/3735487603' },
  { kind: 'oreum', name: '용눈이오름', lat: 33.459907, lng: 126.832502, osm: 'node/5507591794' },
  { kind: 'oreum', name: '거문오름', lat: 33.337173, lng: 126.700164, osm: 'node/5712863816' },
  { kind: 'harbor', name: '제주항', lat: 33.52451, lng: 126.54436, osm: 'way/766674615' },
  { kind: 'field', name: '성실농원', lat: 33.27124, lng: 126.38582, osm: 'way/375033594' },
  { kind: 'field', name: '엉또농원', lat: 33.268255, lng: 126.498532, osm: 'way/375043811' },
  { kind: 'cliff', name: '자리둔덕', lat: 33.239181, lng: 126.543512, osm: 'node/4832613087' },
  { kind: 'cliff', name: '월평해안경승지구', lat: 33.237909, lng: 126.461503, osm: 'node/4832613102' },
  { kind: 'street', name: '탐라문화광장', lat: 33.513312, lng: 126.527224, osm: 'way/1530008123' },
  { kind: 'street', name: '제주칠성로', lat: 33.515928, lng: 126.525593, osm: 'way/1532073543' },
];

const KIND_FOR_SCENE: Record<SceneChoice, SpotKind> = {
  바다: 'coast',
  밤: 'coast',
  오름: 'oreum',
  들판: 'field',
  절벽: 'cliff',
  항구: 'harbor',
  거리: 'street',
  사람: 'street',
};

export function isJeju(name: string): boolean {
  const folded = name.replace(/\s+/g, '').toLowerCase();
  return folded.includes('제주') || folded.includes('jeju');
}

export function spotsForRegion(name: string): Spot[] | null {
  if (isJeju(name)) return JEJU_SPOTS;
  return null;
}

export function pickSpots(scene: SceneChoice, spots: Spot[], sunAzimuth: number | null): Spot[] {
  const kind = KIND_FOR_SCENE[scene];
  const pool = spots.filter((spot) => spot.kind === kind);
  if (kind !== 'coast' || sunAzimuth === null) {
    return [...pool].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
  return [...pool].sort((a, b) => angleGap(a.seaward ?? 0, sunAzimuth) - angleGap(b.seaward ?? 0, sunAzimuth));
}

export function cardinal(bearing: number): string {
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return names[Math.round(bearing / 45) % 8];
}

export function whySpot(scene: SceneChoice, spot: Spot): string {
  const name = topic(spot.name);
  if (spot.kind === 'coast') {
    const facing = spot.seaward === undefined ? '바다 쪽' : `${cardinal(spot.seaward)}쪽`;
    const light = scene === '밤' ? '해가 진 뒤 남색 하늘' : '그 시각의 해';
    return `${name} OpenStreetMap에 해안으로 있습니다. 바다는 ${facing}이라 ${light}을 바다 방향으로 둘 수 있습니다.`;
  }
  if (spot.kind === 'oreum') {
    return `${name} OpenStreetMap에 오름으로 있습니다. 주변보다 높아 하늘이 트입니다.`;
  }
  if (spot.kind === 'harbor') {
    return `${name} OpenStreetMap에 항구로 있습니다. 부두와 수평선이 한 자리에 있습니다.`;
  }
  if (spot.kind === 'field') {
    return `${name} OpenStreetMap에 농지로 있습니다. 트인 들판이라 들판 유형을 그 자리에서 시도할 수 있습니다.`;
  }
  if (spot.kind === 'cliff') {
    return `${name} OpenStreetMap에 절벽으로 있습니다. 아래가 열려 있습니다.`;
  }
  if (scene === '사람') {
    return `${name} OpenStreetMap에 사람이 걷는 거리로 있습니다. 사람이 지나가는 유형을 그 자리에서 시도할 수 있습니다.`;
  }
  return `${name} OpenStreetMap에 사람이 걷는 거리로 있습니다. 길 유형을 그 자리에서 시도할 수 있습니다.`;
}

export function spotCounts(spots: Spot[]): string {
  const labels: [SpotKind, string][] = [
    ['coast', '해안'],
    ['oreum', '오름'],
    ['harbor', '항구'],
    ['field', '들판'],
    ['cliff', '절벽'],
    ['street', '거리'],
  ];
  return labels
    .map(([kind, label]) => {
      const count = spots.filter((spot) => spot.kind === kind).length;
      return count > 0 ? `${label} ${count}곳` : '';
    })
    .filter(Boolean)
    .join(', ');
}

function topic(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  const batchim = hangul && (code - 0xac00) % 28 !== 0;
  return `${name}${batchim ? '은' : '는'}`;
}

function angleGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export async function loadSpotsAround(
  south: number,
  west: number,
  north: number,
  east: number,
  signal: AbortSignal,
): Promise<Spot[]> {
  const box = shrink(south, west, north, east);
  const query = `[out:json][timeout:25];(${spotQuery(box)});out center tags;`;
  const response = await fetch('https://overpass.openstreetmap.fr/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`overpass ${response.status}`);
  const payload = (await response.json()) as { elements?: OverpassElement[] };
  return elementsToSpots(payload.elements ?? []);
}

export function elementsToSpots(elements: OverpassElement[]): Spot[] {
  const seen = new Set<string>();
  const spots: Spot[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags['name:ko'] || tags.name;
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!name || lat === undefined || lng === undefined) continue;
    const kind = kindOf(tags);
    if (!kind) continue;
    const key = `${kind}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spots.push({ kind, name, lat, lng, osm: `${element.type ?? 'osm'}/${element.id ?? name}` });
  }
  return spots;
}

function kindOf(tags: Record<string, string>): SpotKind | null {
  if (tags.natural === 'beach') return 'coast';
  if (tags.natural === 'cliff') return 'cliff';
  if (tags.natural === 'peak' && (tags.name ?? '').includes('오름')) return 'oreum';
  if (tags.harbour) return 'harbor';
  if (tags.landuse === 'farmland' && tags.name) return 'field';
  if (tags.place === 'square' || tags.highway === 'pedestrian') return 'street';
  return null;
}

function spotQuery(box: [number, number, number, number]): string {
  const [s, w, n, e] = box;
  const bbox = `(${s},${w},${n},${e})`;
  return [
    `node["natural"="beach"]["name"]${bbox};way["natural"="beach"]["name"]${bbox};`,
    `node["natural"="cliff"]["name"]${bbox};way["natural"="cliff"]["name"]${bbox};`,
    `node["harbour"]["name"]${bbox};way["harbour"]["name"]${bbox};`,
    `way["landuse"="farmland"]["name"]${bbox};`,
    `node["natural"="peak"]["name"~"오름"]${bbox};`,
    `way["highway"="pedestrian"]["name"]${bbox};node["place"="square"]["name"]${bbox};`,
  ].join('');
}

function shrink(south: number, west: number, north: number, east: number): [number, number, number, number] {
  if (north - south <= 0.8 && east - west <= 0.8) return [south, west, north, east];
  const lat = (south + north) / 2;
  const lng = (west + east) / 2;
  return [lat - 0.15, lng - 0.18, lat + 0.15, lng + 0.18];
}
