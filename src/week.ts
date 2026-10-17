import { SEOUL } from './time';

export interface DatedPick {
  id: string;
  startsAt: string;
}

/** The Sunday 09:00 Asia/Seoul instant that is already in effect. */
export function seoulSundayNine(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(now);
  const year = Number(value(parts, 'year'));
  const month = Number(value(parts, 'month'));
  const day = Number(value(parts, 'day'));
  const hour = Number(value(parts, 'hour'));
  const weekday = value(parts, 'weekday');
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  let back = index;
  if (index === 0 && hour < 9) back = 7;
  const sunday = new Date(Date.UTC(year, month - 1, day - back));
  return new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()));
}

export function pickForInstant<T extends DatedPick>(picks: T[], now = new Date()): T {
  if (picks.length === 0) throw new Error('no picks');
  const ordered = [...picks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const instant = seoulSundayNine(now).toISOString();
  let chosen = ordered[0];
  for (const pick of ordered) {
    if (pick.startsAt <= instant) chosen = pick;
  }
  return chosen;
}

export function formatSelection(startsAt: string): string {
  const date = new Date(startsAt);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).formatToParts(date);
  const month = value(parts, 'month');
  const day = value(parts, 'day');
  const weekday = value(parts, 'weekday');
  return `${month.endsWith('월') ? month : `${month}월`} ${day.endsWith('일') ? day : `${day}일`} ${weekday} 09:00 선정`;
}

function value(parts: Intl.DateTimeFormatPart[], type: string): string {
  const found = parts.find((item) => item.type === type);
  if (!found) throw new Error(`missing date part ${type}`);
  return found.value;
}
