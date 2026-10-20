export interface SearchHit {
  id: string;
  label: string;
  lat: number;
  lng: number;
  south: number;
  north: number;
  west: number;
  east: number;
}

interface NominatimHit {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
}

/** 좌표로 공개 지도의 주소를 찾습니다. 응답에 주소가 없으면 null입니다. */
export async function reverseAddress(lat: number, lng: number, signal: AbortSignal): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '16');
  url.searchParams.set('accept-language', 'ko');
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const payload = (await response.json()) as { address?: Record<string, unknown> };
  return shortReverse(payload.address);
}

function shortReverse(address: Record<string, unknown> | undefined): string | null {
  if (!address) return null;
  const text = (key: string) => (typeof address[key] === 'string' ? address[key].trim() : '');
  const street = [text('road'), text('house_number')].filter(Boolean).join(' ');
  const local = text('village') || text('hamlet') || text('suburb') || text('neighbourhood') || text('quarter');
  const town = text('town') || text('city_district') || text('municipality');
  const city = text('city') || text('county');
  const parts = [...new Set([street, local, town, city].filter(Boolean))];
  return parts.length > 0 ? parts.join(', ') : null;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<SearchHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', 'ko');
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);
  const payload = (await response.json()) as NominatimHit[];
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((hit) => {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    const label = hit.display_name?.trim() ?? '';
    const box = hit.boundingbox?.map(Number) ?? [];
    const south = box[0];
    const north = box[1];
    const west = box[2];
    const east = box[3];
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      id: String(hit.place_id ?? label),
      label,
      lat,
      lng,
      south: Number.isFinite(south) ? south : lat - 0.15,
      north: Number.isFinite(north) ? north : lat + 0.15,
      west: Number.isFinite(west) ? west : lng - 0.18,
      east: Number.isFinite(east) ? east : lng + 0.18,
    }];
  });
}
