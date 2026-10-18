import type { WindowKind } from './places';
import { getDaySky, skyPosition } from './sky';
import { formatClock, formatRange } from './time';
import { sampleTime, shotWindow } from './windows';

export function windowName(kind: WindowKind): string {
  switch (kind) {
    case 'sunset-20':
      return '일몰 직전 20분';
    case 'sunrise-20':
      return '일출 뒤 20분';
    case 'evening-golden':
      return '저녁 골든아워';
    case 'morning-golden':
      return '아침 골든아워';
    case 'evening-blue':
      return '저녁 블루아워';
    case 'morning-blue':
      return '아침 블루아워';
    case 'moon-40':
      return '월출 뒤 40분';
  }
}

export function aimFor(kind: WindowKind): number | null {
  if (kind === 'morning-golden' || kind === 'sunrise-20' || kind === 'morning-blue') return 100;
  if (kind === 'evening-golden' || kind === 'sunset-20' || kind === 'evening-blue') return 260;
  return null;
}

export interface SunPlan {
  summary: string;
  arrive: string;
  azimuth: number | null;
  altitude: number | null;
}

export function sunPlan(lat: number, lng: number, kind: WindowKind, now = new Date()): SunPlan {
  const today = shotWindow(kind, getDaySky(lat, lng, 0, 0, now));
  if (today && today.end.getTime() > now.getTime()) return pack('오늘', today, kind, lat, lng, now);
  const tomorrow = shotWindow(kind, getDaySky(lat, lng, 0, 1, now));
  if (tomorrow) return pack('내일', tomorrow, kind, lat, lng, now);
  return { summary: windowName(kind), arrive: '이 좌표에서 그 시간 창을 계산하지 못했습니다.', azimuth: null, altitude: null };
}

export function recommendTime(lat: number, lng: number, kind: WindowKind, now = new Date()): string {
  return sunPlan(lat, lng, kind, now).summary;
}

function pack(
  day: string,
  window: { start: Date; end: Date },
  kind: WindowKind,
  lat: number,
  lng: number,
  now: Date,
): SunPlan {
  const sun = skyPosition('sun', sampleTime(kind, window), lat, lng, 0);
  const arriveAt = new Date(window.start.getTime() - 30 * 60 * 1000);
  const range = formatRange(window.start, window.end);
  const arrive =
    arriveAt.getTime() > now.getTime()
      ? `${day} ${formatClock(arriveAt)}에 도착합니다. 창은 ${range}입니다.`
      : `창이 이미 열려 있습니다. 지금 가면 ${range} 안에 있습니다.`;
  return {
    summary: `${day} ${range} · ${windowName(kind)} · 해 방위 ${Math.round(sun.azimuth)}°`,
    arrive,
    azimuth: Math.round(sun.azimuth),
    altitude: Math.round(sun.altitude * 10) / 10,
  };
}
