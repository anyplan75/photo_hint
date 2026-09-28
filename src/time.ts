export const SEOUL = 'Asia/Seoul';
export const ALERT_LEAD_MS = 30 * 60 * 1000;

export function seoulDayStart(dayOffset: number, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(part(parts, 'year'));
  const month = Number(part(parts, 'month'));
  const day = Number(part(parts, 'day'));
  return new Date(Date.UTC(year, month - 1, day + dayOffset, 0, 0, 0) - 9 * 60 * 60 * 1000);
}

export function formatClock(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEOUL,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return `${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

export function formatRange(start: Date, end: Date): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function formatDay(dayOffset: number, now = new Date()): string {
  const noon = new Date(seoulDayStart(dayOffset, now).getTime() + 12 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(noon);
}

export function formatWhen(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '곧';
  if (minutes < 60) return `${minutes}분 후`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간 후` : `${hours}시간 ${rest}분 후`;
}

export function dayLabel(dayOffset: number): string {
  return dayOffset === 0 ? '오늘' : '내일';
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find((item) => item.type === type);
  if (!found) throw new Error(`missing date part ${type}`);
  return found.value;
}
