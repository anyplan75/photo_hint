import type { WindowKind } from './places';
import { getDaySky } from './sky';
import { formatRange } from './time';
import { shotWindow } from './windows';

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

export function recommendTime(lat: number, lng: number, kind: WindowKind, now = new Date()): string {
  const today = shotWindow(kind, getDaySky(lat, lng, 0, 0, now));
  if (today && today.end.getTime() > now.getTime()) {
    return `오늘 ${formatRange(today.start, today.end)} · ${windowName(kind)}`;
  }
  const tomorrow = shotWindow(kind, getDaySky(lat, lng, 0, 1, now));
  if (tomorrow) {
    return `내일 ${formatRange(tomorrow.start, tomorrow.end)} · ${windowName(kind)}`;
  }
  return windowName(kind);
}
