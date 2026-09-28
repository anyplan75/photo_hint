import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
  SearchRiseSet,
} from 'astronomy-engine';
import { seoulDayStart } from './time';

export interface DaySky {
  dayStart: Date;
  dayEnd: Date;
  sunrise: Date | null;
  sunset: Date | null;
  goldenMorningEnd: Date | null;
  goldenEveningStart: Date | null;
  blueMorningStart: Date | null;
  blueEveningEnd: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  moonPhaseDegrees: number;
  moonLitFraction: number;
}

export interface SkyPoint {
  azimuth: number;
  altitude: number;
}

const cache = new Map<string, DaySky>();

export function getDaySky(lat: number, lng: number, elevationM: number, dayOffset: number, now = new Date()): DaySky {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${elevationM},${dayOffset},${seoulDayStart(0, now).toISOString()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const dayStart = seoulDayStart(dayOffset, now);
  const dayEnd = seoulDayStart(dayOffset + 1, now);
  const observer = new Observer(lat, lng, elevationM);
  const noon = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000);

  const sky: DaySky = {
    dayStart,
    dayEnd,
    sunrise: eventOnDay(SearchRiseSet(Body.Sun, observer, +1, dayStart, 1), dayStart, dayEnd),
    sunset: eventOnDay(SearchRiseSet(Body.Sun, observer, -1, dayStart, 1), dayStart, dayEnd),
    goldenMorningEnd: eventOnDay(SearchAltitude(Body.Sun, observer, +1, dayStart, 1, 6), dayStart, dayEnd),
    goldenEveningStart: eventOnDay(SearchAltitude(Body.Sun, observer, -1, dayStart, 1, 6), dayStart, dayEnd),
    blueMorningStart: eventOnDay(SearchAltitude(Body.Sun, observer, +1, dayStart, 1, -6), dayStart, dayEnd),
    blueEveningEnd: eventOnDay(SearchAltitude(Body.Sun, observer, -1, dayStart, 1, -6), dayStart, dayEnd),
    moonrise: eventOnDay(SearchRiseSet(Body.Moon, observer, +1, dayStart, 1), dayStart, dayEnd),
    moonset: eventOnDay(SearchRiseSet(Body.Moon, observer, -1, dayStart, 1), dayStart, dayEnd),
    moonPhaseDegrees: MoonPhase(noon),
    moonLitFraction: Illumination(Body.Moon, noon).phase_fraction,
  };

  cache.set(key, sky);
  return sky;
}

export function skyPosition(
  body: 'sun' | 'moon',
  date: Date,
  lat: number,
  lng: number,
  elevationM: number,
): SkyPoint {
  const observer = new Observer(lat, lng, elevationM);
  const target = body === 'sun' ? Body.Sun : Body.Moon;
  const equatorial = Equator(target, date, observer, true, true);
  const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
  return { azimuth: horizontal.azimuth, altitude: horizontal.altitude };
}

export function moonPhaseName(degrees: number): string {
  const cycle = ((degrees % 360) + 360) % 360;
  if (cycle < 22.5 || cycle >= 337.5) return '삭';
  if (cycle < 67.5) return '초승';
  if (cycle < 112.5) return '상현';
  if (cycle < 157.5) return '차오르는 달';
  if (cycle < 202.5) return '보름';
  if (cycle < 247.5) return '기우는 달';
  if (cycle < 292.5) return '하현';
  return '그믐';
}

function eventOnDay(result: { date: Date } | null, dayStart: Date, dayEnd: Date): Date | null {
  if (!result) return null;
  const time = result.date.getTime();
  if (time < dayStart.getTime() || time >= dayEnd.getTime()) return null;
  return result.date;
}
