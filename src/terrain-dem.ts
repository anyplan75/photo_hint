import { mapboxPublicToken } from './mapbox-token';
import { elevationFromRgb } from './sightline';

interface TerrainPoint {
  lat: number;
  lng: number;
  distanceM: number;
}

export interface TerrainRead {
  ok: boolean;
  /** 타일을 거절한 HTTP 상태. 없으면 null입니다. */
  status: number | null;
  elevations: Array<number | null>;
  note: string | null;
}

/**
 * 맵박스 지형 타일에서 시선 위 높이를 읽습니다.
 * 타일이 403이거나 비어 있으면 높이를 만들지 않습니다.
 */
export async function readTerrain(samples: TerrainPoint[], signal: AbortSignal): Promise<TerrainRead> {
  return readElevations(samples, signal, false);
}

/**
 * 화면을 가로지르는 능선용입니다.
 * 거절된 타일 자리만 비우고, 읽힌 높이는 그대로 둡니다.
 */
export async function readTerrainLoose(samples: TerrainPoint[], signal: AbortSignal): Promise<TerrainRead> {
  return readElevations(samples, signal, true);
}

async function readElevations(samples: TerrainPoint[], signal: AbortSignal, loose: boolean): Promise<TerrainRead> {
  const token = mapboxPublicToken();
  const empty = samples.map(() => null);
  if (!token) {
    return { ok: false, status: null, elevations: empty, note: '지도 암호가 없어 지면 높이를 읽지 않습니다. 높이를 짐작하지 않습니다.' };
  }
  if (samples.length === 0) return { ok: false, status: null, elevations: empty, note: null };
  const farthest = samples.reduce((max, sample) => Math.max(max, sample.distanceM), 0);
  const zoom = chooseZoom(farthest, loose);
  const tiles = new Map<string, { pixels: Promise<ImageData | null>; status: Promise<number | null> }>();
  const elevations: Array<number | null> = [];
  let failure: number | null = null;
  for (const sample of samples) {
    const spot = tileIndex(sample.lng, sample.lat, zoom);
    const key = `${zoom}/${spot.x}/${spot.y}`;
    let tile = tiles.get(key);
    if (!tile) {
      const pending = loadTile(zoom, spot.x, spot.y, token, signal);
      tile = { pixels: pending.then((item) => item.pixels), status: pending.then((item) => item.status) };
      tiles.set(key, tile);
    }
    const pixels = await tile.pixels;
    const status = await tile.status;
    if (signal.aborted) return { ok: false, status: failure, elevations: empty, note: null };
    if (!pixels || status !== null) {
      failure = status ?? failure ?? 0;
      if (!loose) {
        return { ok: false, status: failure, elevations: empty, note: terrainNote(failure) };
      }
      elevations.push(null);
      continue;
    }
    const px = Math.min(pixels.width - 1, Math.max(0, Math.floor(spot.fx * pixels.width)));
    const py = Math.min(pixels.height - 1, Math.max(0, Math.floor(spot.fy * pixels.height)));
    const index = (py * pixels.width + px) * 4;
    elevations.push(elevationFromRgb(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]));
  }
  const any = elevations.some((item) => item !== null);
  return {
    ok: loose ? any : failure === null,
    status: failure,
    elevations,
    note: failure === null ? null : loose ? looseNote(failure) : terrainNote(failure),
  };
}

function looseNote(status: number | null): string {
  if (status === 403) return '일부 지형 타일을 받지 못했습니다 (HTTP 403). 그 구간은 비워 둡니다.';
  if (status === 404) return '일부 구간의 지형 타일이 없습니다 (HTTP 404). 그 구간은 비워 둡니다.';
  return '일부 지형 타일을 읽지 못했습니다. 그 구간은 비워 둡니다.';
}

function terrainNote(status: number | null): string {
  if (status === 403) {
    return '맵박스 지형 타일을 받지 못했습니다 (HTTP 403). 높이를 짐작해 그리지 않습니다.';
  }
  if (status === 404) {
    return '이 구간의 맵박스 지형 타일이 없습니다 (HTTP 404). 높이를 짐작해 그리지 않습니다.';
  }
  return '맵박스 지형 타일을 읽지 못했습니다. 높이를 짐작해 그리지 않습니다.';
}

function chooseZoom(distanceM: number, loose: boolean): number {
  if (loose) return distanceM < 12000 ? 13 : 12;
  if (distanceM < 2000) return 14;
  if (distanceM < 8000) return 13;
  return 12;
}

async function loadTile(
  zoom: number,
  x: number,
  y: number,
  token: string,
  signal: AbortSignal,
): Promise<{ pixels: ImageData | null; status: number | null }> {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${zoom}/${x}/${y}.pngraw?access_token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch(url, { signal, referrerPolicy: 'strict-origin-when-cross-origin' });
    if (!response.ok) return { pixels: null, status: response.status };
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { pixels: null, status: null };
    context.drawImage(bitmap, 0, 0);
    return { pixels: context.getImageData(0, 0, bitmap.width, bitmap.height), status: null };
  } catch {
    if (signal.aborted) return { pixels: null, status: null };
    return { pixels: null, status: 0 };
  }
}

function tileIndex(lng: number, lat: number, zoom: number): { x: number; y: number; fx: number; fy: number } {
  const n = 2 ** zoom;
  const globalX = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const globalY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  const x = Math.floor(globalX);
  const y = Math.floor(globalY);
  return { x, y, fx: globalX - x, fy: globalY - y };
}
