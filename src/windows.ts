import type { WindowKind } from './places';
import type { DaySky } from './sky';

export interface TimeWindow {
  start: Date;
  end: Date;
}

const MINUTE = 60 * 1000;

export function shotWindow(kind: WindowKind, sky: DaySky): TimeWindow | null {
  switch (kind) {
    case 'sunset-20':
      return before(sky.sunset, 20);
    case 'sunrise-20':
      return after(sky.sunrise, 20);
    case 'evening-golden':
      return between(sky.goldenEveningStart, sky.sunset);
    case 'morning-golden':
      return between(sky.sunrise, sky.goldenMorningEnd);
    case 'evening-blue':
      return between(sky.sunset, sky.blueEveningEnd);
    case 'morning-blue':
      return between(sky.blueMorningStart, sky.sunrise);
    case 'moon-40':
      return after(sky.moonrise, 40);
  }
}

export function sampleTime(kind: WindowKind, window: TimeWindow): Date {
  const span = window.end.getTime() - window.start.getTime();
  const fraction = kind === 'sunset-20' || kind === 'evening-golden' || kind === 'evening-blue' ? 0.7 : 0.3;
  return new Date(window.start.getTime() + span * fraction);
}

function before(end: Date | null, minutes: number): TimeWindow | null {
  if (!end) return null;
  return { start: new Date(end.getTime() - minutes * MINUTE), end };
}

function after(start: Date | null, minutes: number): TimeWindow | null {
  if (!start) return null;
  return { start, end: new Date(start.getTime() + minutes * MINUTE) };
}

function between(start: Date | null, end: Date | null): TimeWindow | null {
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}
