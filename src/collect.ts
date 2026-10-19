import { formatDistance } from './geo';
import { aimFor, recommendTime } from './recommend';
import {
  kindForScene,
  kindLabel,
  matchLabel,
  type RankedSpot,
  type SceneChoice,
  type Spot,
} from './region-places';
import type { ShootPoint } from './shoot-points';
import type { WindowKind } from './places';

export type LightCall = 'stand' | 'wait' | 'other';

export interface RankedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kindLabel: string;
  sourceLabel: string;
  score: number;
  call: LightCall;
  callTitle: string;
  headline: string;
  nowLine: string;
  distanceKm: number | null;
  mine: boolean;
  spot: RankedSpot | null;
  pointId: string | null;
}

/**
 * 반경 안의 공개된 자리와 저장한 촬영 지점을 장면 점수로 줄 세웁니다.
 * 점수가 같으면 가까운 곳이 앞입니다.
 */
export function rankPlaces(input: {
  spots: Spot[];
  points: ShootPoint[];
  scene: SceneChoice | null;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  windowKind: WindowKind;
  now: Date;
}): RankedPlace[] {
  const azimuth = aimFor(input.windowKind);
  const ranked: RankedPlace[] = [];
  for (const spot of input.spots) {
    const distanceKm = input.center ? kilometers(input.center.lat, input.center.lng, spot.lat, spot.lng) : null;
    if (distanceKm !== null && distanceKm > input.radiusKm + 0.3) continue;
    const scored = scoreSpot(spot, input.scene, azimuth);
    const placeSpot: RankedSpot = { ...spot, matchesScene: scored.matches };
    ranked.push({
      id: spot.osm,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      kindLabel: kindLabel(spot.kind),
      sourceLabel: '주변',
      score: scored.score,
      call: scored.call,
      callTitle: callTitle(scored.call),
      headline: input.scene ? matchLabel(input.scene, placeSpot) : kindLabel(spot.kind),
      nowLine: recommendTime(spot.lat, spot.lng, input.windowKind, input.now),
      distanceKm,
      mine: false,
      spot: placeSpot,
      pointId: null,
    });
  }
  for (const point of input.points) {
    const nearSpot = ranked.some((place) => kilometers(place.lat, place.lng, point.lat, point.lng) < 0.08 && place.name === point.name);
    if (nearSpot) continue;
    const distanceKm = input.center ? kilometers(input.center.lat, input.center.lng, point.lat, point.lng) : null;
    ranked.push({
      id: point.id,
      name: point.name,
      lat: point.lat,
      lng: point.lng,
      kindLabel: '내 자리',
      sourceLabel: '내 자리',
      score: 66,
      call: 'wait',
      callTitle: callTitle('wait'),
      headline: '직접 저장한 촬영 지점',
      nowLine: recommendTime(point.lat, point.lng, input.windowKind, input.now),
      distanceKm,
      mine: true,
      spot: null,
      pointId: point.id,
    });
  }
  ranked.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return (left.distanceKm ?? 999) - (right.distanceKm ?? 999);
  });
  return ranked;
}

export function distanceLabel(km: number | null): string {
  if (km === null) return '';
  return formatDistance(km * 1000);
}

export function activeScene(weekly: SceneChoice | null, preferred: SceneChoice[]): SceneChoice | null {
  if (preferred.length === 0) return weekly;
  if (weekly && preferred.includes(weekly)) return weekly;
  return preferred[0];
}

export function boxAround(lat: number, lng: number, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111;
  const cosine = Math.cos((lat * Math.PI) / 180) || 0.01;
  const dLng = radiusKm / (111 * cosine);
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

function scoreSpot(spot: Spot, scene: SceneChoice | null, azimuth: number | null): { score: number; matches: boolean; call: LightCall } {
  const matches = scene ? kindForScene(scene) === spot.kind : false;
  let score = scene ? (matches ? 70 : 36) : 48;
  if (matches && spot.kind === 'coast' && spot.seaward !== undefined && azimuth !== null) {
    score += Math.round((1 - angleGap(spot.seaward, azimuth) / 180) * 26);
  } else if (matches) {
    score += 8;
  }
  score = Math.max(0, Math.min(99, score));
  const call: LightCall = matches && score >= 84 ? 'stand' : matches && score >= 60 ? 'wait' : 'other';
  return { score, matches, call };
}

function callTitle(call: LightCall): string {
  if (call === 'stand') return '이 빛에 서기';
  if (call === 'wait') return '시간에 맞추기';
  return '장면과 다름';
}

function kilometers(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earth = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function angleGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}
