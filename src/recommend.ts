import type { WindowKind } from './places';
import { getDaySky, skyPosition } from './sky';
import { formatRange } from './time';
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

export function recommendTime(lat: number, lng: number, kind: WindowKind, now = new Date()): string {
  const today = shotWindow(kind, getDaySky(lat, lng, 0, 0, now));
  if (today && today.end.getTime() > now.getTime()) {
    return line('오늘', today, kind, lat, lng);
  }
  const tomorrow = shotWindow(kind, getDaySky(lat, lng, 0, 1, now));
  if (tomorrow) return line('내일', tomorrow, kind, lat, lng);
  return windowName(kind);
}

function line(day: string, window: { start: Date; end: Date }, kind: WindowKind, lat: number, lng: number): string {
  const sun = skyPosition('sun', sampleTime(kind, window), lat, lng, 0);
  return `${day} ${formatRange(window.start, window.end)} · ${windowName(kind)} · 해 방위 ${Math.round(sun.azimuth)}°`;
}
