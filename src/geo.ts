export function distanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const earth = 6371000;
  const φ1 = toRadians(fromLat);
  const φ2 = toRadians(toLat);
  const Δφ = toRadians(toLat - fromLat);
  const Δλ = toRadians(toLng - fromLng);
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const φ1 = toRadians(fromLat);
  const φ2 = toRadians(toLat);
  const Δλ = toRadians(toLng - fromLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalize(toDegrees(Math.atan2(y, x)));
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
