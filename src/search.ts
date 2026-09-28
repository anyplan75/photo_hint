export interface SearchHit {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

interface NominatimHit {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
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
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ id: String(hit.place_id ?? label), label, lat, lng }];
  });
}
