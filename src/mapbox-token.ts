/** A public Mapbox token (pk.) from the build environment. Never a secret sk. token. */
export function mapboxPublicToken(value?: string): string | null {
  const raw = (value !== undefined ? value : readToken()).trim();
  if (!raw.startsWith('pk.')) return null;
  return raw;
}

function readToken(): string {
  try {
    return import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN ?? '';
  } catch {
    return '';
  }
}
