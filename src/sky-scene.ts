import {
  Body,
  Equator,
  Horizon,
  HorizonFromVector,
  Illumination,
  JUPITER_MEAN_RADIUS_KM,
  KM_PER_AU,
  Libration,
  MoonPhase,
  Observer,
  Rotation_EQJ_HOR,
  Rotation_GAL_EQJ,
  RotateVector,
  SearchAltitude,
  Spherical,
  VectorFromSphere,
  type RotationMatrix,
} from 'astronomy-engine';
import { getDaySky, skyPosition } from './sky';
import { seoulParts } from './time';

/** astronomy-engine이 해·달 크기에 쓰는 반지름과 같은 값입니다. 라이브러리가 이 숫자를 밖으로 주지 않습니다. */
const SUN_RADIUS_KM = 695700;
const MOON_RADIUS_KM = 1738.1;

/** 맨눈 행성의 평균 반지름(km)입니다. 목성은 라이브러리 값을 그대로 씁니다. */
const PLANET_RADIUS_KM: Record<string, number> = {
  Mercury: 2439.7,
  Venus: 6051.8,
  Mars: 3389.5,
  Jupiter: JUPITER_MEAN_RADIUS_KM,
  Saturn: 58232,
  Uranus: 25362,
};

export const MOON_STAGE_COUNT = 15;
const MOON_STAGE_SPAN = 360 / MOON_STAGE_COUNT;

const MOON_STAGE_NAMES = [
  '삭',
  '초승',
  '초승',
  '상현 전',
  '상현',
  '차는 달',
  '차는 달',
  '보름',
  '기우는 달',
  '기우는 달',
  '하현 전',
  '하현',
  '그믐',
  '그믐',
  '그믐',
];

/**
 * 밝은 별의 짧은 목록입니다. 적경·적위는 J2000, 등급은 겉보기 등급입니다.
 * 아무 점에 이름을 붙이지 않고, 이름 있는 별만 둡니다.
 */
const BRIGHT_STARS: { name: string; raHours: number; dec: number; mag: number }[] = [
  { name: '시리우스', raHours: 6.7525, dec: -16.7161, mag: -1.46 },
  { name: '카노푸스', raHours: 6.3992, dec: -52.6957, mag: -0.74 },
  { name: '아크투루스', raHours: 14.261, dec: 19.1824, mag: -0.05 },
  { name: '베가', raHours: 18.6156, dec: 38.7837, mag: 0.03 },
  { name: '카펠라', raHours: 5.2782, dec: 45.998, mag: 0.08 },
  { name: '리겔', raHours: 5.2423, dec: -8.2016, mag: 0.13 },
  { name: '프로키온', raHours: 7.6552, dec: 5.225, mag: 0.34 },
  { name: '아케르나르', raHours: 1.6286, dec: -57.2367, mag: 0.46 },
  { name: '베텔게우스', raHours: 5.9195, dec: 7.4071, mag: 0.5 },
  { name: '알타이르', raHours: 19.8464, dec: 8.8683, mag: 0.77 },
  { name: '알데바란', raHours: 4.5987, dec: 16.5093, mag: 0.85 },
  { name: '스피카', raHours: 13.4199, dec: -11.1613, mag: 0.97 },
  { name: '안타레스', raHours: 16.4901, dec: -26.432, mag: 1.06 },
  { name: '폴룩스', raHours: 7.7553, dec: 28.0262, mag: 1.14 },
  { name: '포말하우트', raHours: 22.9608, dec: -29.6222, mag: 1.16 },
  { name: '데네브', raHours: 20.6905, dec: 45.2803, mag: 1.25 },
  { name: '레굴루스', raHours: 10.1395, dec: 11.9672, mag: 1.4 },
];

/**
 * 큰 유성우입니다. 날짜는 해마다 반복되는 활동 기간이고, 복사점은 극대 무렵의 적경·적위입니다.
 * 기간 안에서 복사점을 날마다 지어 옮기지 않습니다.
 */
const SHOWERS: { name: string; start: [number, number]; end: [number, number]; raDeg: number; dec: number }[] = [
  { name: '사분의자리 유성우', start: [12, 28], end: [1, 12], raDeg: 230, dec: 49 },
  { name: '거문고자리 유성우', start: [4, 14], end: [4, 30], raDeg: 271, dec: 34 },
  { name: '물병자리 에타 유성우', start: [4, 19], end: [5, 28], raDeg: 338, dec: -1 },
  { name: '물병자리 델타 유성우', start: [7, 12], end: [8, 23], raDeg: 340, dec: -16 },
  { name: '페르세우스자리 유성우', start: [7, 17], end: [8, 24], raDeg: 48, dec: 58 },
  { name: '용자리 유성우', start: [10, 6], end: [10, 10], raDeg: 262, dec: 54 },
  { name: '오리온자리 유성우', start: [10, 2], end: [11, 7], raDeg: 95, dec: 16 },
  { name: '사자자리 유성우', start: [11, 6], end: [11, 30], raDeg: 152, dec: 22 },
  { name: '쌍둥이자리 유성우', start: [12, 4], end: [12, 17], raDeg: 112, dec: 33 },
  { name: '작은곰자리 유성우', start: [12, 17], end: [12, 26], raDeg: 217, dec: 76 },
];

const PLANETS: { body: Body; kind: IconKind; name: string }[] = [
  { body: Body.Mercury, kind: 'mercury', name: '수성' },
  { body: Body.Venus, kind: 'venus', name: '금성' },
  { body: Body.Mars, kind: 'mars', name: '화성' },
  { body: Body.Jupiter, kind: 'jupiter', name: '목성' },
  { body: Body.Saturn, kind: 'saturn', name: '토성' },
  { body: Body.Uranus, kind: 'uranus', name: '천왕성' },
];

export type IconKind =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'star'
  | 'meteor'
  | 'sunrise'
  | 'sunset'
  | 'moonrise'
  | 'moonset'
  | 'golden'
  | 'blue'
  | 'civil'
  | 'nautical'
  | 'astronomical'
  | 'galaxy';

export interface SkyIcon {
  id: string;
  kind: IconKind;
  name: string;
  azimuth: number;
  altitude: number;
  /** 각지름(도). 별과 사건, 은하는 0입니다. */
  diameterDeg: number;
  sizeLabel: string;
  moonStage?: number;
  moonShapeDeg?: number;
  /** 밝은 쪽이 하늘 위쪽(고도가 커지는 쪽)에서 시계 방향으로 돌아간 각(라디안) */
  limbRad?: number;
  mag?: number;
  active?: boolean;
}

export interface GalaxySample {
  azimuth: number;
  altitude: number;
  lon: number;
  lat: number;
}

export interface SkyMark {
  id: string;
  kind: IconKind;
  name: string;
  azimuth: number;
  altitude: number;
  startMs: number;
  endMs: number;
}

export interface SkyScene {
  icons: SkyIcon[];
  galaxy: GalaxySample[];
  sun: SkyIcon;
  moon: SkyIcon;
  showers: string[];
  marks: SkyMark[];
}

export interface MoonStage {
  index: number;
  /** 0부터 14까지. 보름에 해당하는 단계는 모양이 정확히 180°입니다. */
  shapeDeg: number;
  name: string;
}

/** 달의 위상각을 15등분해서 그 구간의 모양을 고릅니다. */
export function moonStage(phaseDeg: number): MoonStage {
  const phase = ((phaseDeg % 360) + 360) % 360;
  const index = Math.min(MOON_STAGE_COUNT - 1, Math.floor(phase / MOON_STAGE_SPAN));
  return {
    index,
    shapeDeg: (index + 0.5) * MOON_STAGE_SPAN,
    name: MOON_STAGE_NAMES[index] ?? `${index}`,
  };
}

/** 달 원반의 한 점이 그 단계의 밝은 면에 있는지 봅니다. x는 오른쪽, y는 위입니다. */
export function moonLit(x: number, y: number, radius: number, shapeDeg: number, limbRad: number): boolean {
  if (x * x + y * y > radius * radius) return false;
  const z = Math.sqrt(Math.max(0, radius * radius - x * x - y * y));
  const psi = (shapeDeg * Math.PI) / 180;
  const sunX = Math.sin(psi) * Math.sin(limbRad);
  const sunY = Math.sin(psi) * Math.cos(limbRad);
  const sunZ = -Math.cos(psi);
  return x * sunX + y * sunY + z * sunZ > 0;
}

/** 달에서 해 쪽이 어느 방향인지입니다. 위쪽이 0이고 오른쪽이 양수입니다. */
export function brightLimbRadians(moonAlt: number, moonAz: number, sunAlt: number, sunAz: number): number {
  const moon = direction(moonAlt, moonAz);
  const sun = direction(sunAlt, sunAz);
  const dot = moon.e * sun.e + moon.n * sun.n + moon.u * sun.u;
  const pe = sun.e - dot * moon.e;
  const pn = sun.n - dot * moon.n;
  const pu = sun.u - dot * moon.u;
  if (Math.hypot(pe, pn, pu) < 1e-6) return 0;
  const up = unit(zenithAcross(moon));
  const right = unit(cross(moon, up));
  const rx = pe * right.e + pn * right.n + pu * right.u;
  const uy = pe * up.e + pn * up.n + pu * up.u;
  return Math.atan2(rx, uy);
}

export function showersOn(date: Date): { name: string; raDeg: number; dec: number }[] {
  const parts = seoulParts(date);
  return SHOWERS.filter((shower) => inWindow(parts.month, parts.day, shower.start, shower.end)).map((shower) => ({
    name: shower.name,
    raDeg: shower.raDeg,
    dec: shower.dec,
  }));
}

/** 날짜가 바뀌면 바뀌는 일출·박명 자리입니다. 시각 막대를 움직일 때마다 다시 찾지 않습니다. */
export function skyMarks(date: Date, lat: number, lng: number, elevationM: number): SkyMark[] {
  const day = getDaySky(lat, lng, elevationM, 0, date);
  const observer = new Observer(lat, lng, elevationM);
  const rising = (altitude: number) => eventOnDay(SearchAltitude(Body.Sun, observer, +1, day.dayStart, 1, altitude), day.dayStart, day.dayEnd);
  const setting = (altitude: number) => eventOnDay(SearchAltitude(Body.Sun, observer, -1, day.dayStart, 1, altitude), day.dayStart, day.dayEnd);
  const blueDawnEnd = rising(-4);
  const blueDuskStart = setting(-4);
  const nauticalDawn = rising(-12);
  const nauticalDusk = setting(-12);
  const astroDawn = rising(-18);
  const astroDusk = setting(-18);
  const marks: SkyMark[] = [];
  addInstant(marks, 'sunrise', 'sunrise', '일출', day.sunrise, 'sun', lat, lng, elevationM);
  addInstant(marks, 'sunset', 'sunset', '일몰', day.sunset, 'sun', lat, lng, elevationM);
  addInstant(marks, 'moonrise', 'moonrise', '월출', day.moonrise, 'moon', lat, lng, elevationM);
  addInstant(marks, 'moonset', 'moonset', '월몰', day.moonset, 'moon', lat, lng, elevationM);
  addWindow(marks, 'golden-am', 'golden', '황금시간', day.sunrise, day.goldenMorningEnd, lat, lng, elevationM);
  addWindow(marks, 'golden-pm', 'golden', '황금시간', day.goldenEveningStart, day.sunset, lat, lng, elevationM);
  addWindow(marks, 'blue-am', 'blue', '블루아워', day.blueMorningStart, blueDawnEnd, lat, lng, elevationM);
  addWindow(marks, 'blue-pm', 'blue', '블루아워', blueDuskStart, day.blueEveningEnd, lat, lng, elevationM);
  addWindow(marks, 'civil-am', 'civil', '시민 박명', day.blueMorningStart, day.sunrise, lat, lng, elevationM);
  addWindow(marks, 'civil-pm', 'civil', '시민 박명', day.sunset, day.blueEveningEnd, lat, lng, elevationM);
  addWindow(marks, 'nautical-am', 'nautical', '항해 박명', nauticalDawn, day.blueMorningStart, lat, lng, elevationM);
  addWindow(marks, 'nautical-pm', 'nautical', '항해 박명', day.blueEveningEnd, nauticalDusk, lat, lng, elevationM);
  addWindow(marks, 'astro-am', 'astronomical', '천문 박명', astroDawn, nauticalDawn, lat, lng, elevationM);
  addWindow(marks, 'astro-pm', 'astronomical', '천문 박명', nauticalDusk, astroDusk, lat, lng, elevationM);
  return marks;
}

/** 고른 시각의 해·달·행성·별·은하수·유성우입니다. */
export function skyBodies(date: Date, lat: number, lng: number, elevationM: number, marks: SkyMark[]): SkyScene {
  const observer = new Observer(lat, lng, elevationM);
  const rot = Rotation_EQJ_HOR(date, observer);
  const sunPos = skyPosition('sun', date, lat, lng, elevationM);
  const moonPos = skyPosition('moon', date, lat, lng, elevationM);
  const sunEq = Equator(Body.Sun, date, observer, true, true);
  const moonEq = Equator(Body.Moon, date, observer, true, true);
  const phase = MoonPhase(date);
  const stage = moonStage(phase);
  const limb = brightLimbRadians(moonPos.altitude, moonPos.azimuth, sunPos.altitude, sunPos.azimuth);
  const sun: SkyIcon = {
    id: 'sun',
    kind: 'sun',
    name: '해',
    azimuth: sunPos.azimuth,
    altitude: sunPos.altitude,
    diameterDeg: discDegrees(SUN_RADIUS_KM, sunEq.dist * KM_PER_AU),
    sizeLabel: '',
    active: sunPos.altitude > -0.8,
  };
  const moon: SkyIcon = {
    id: 'moon',
    kind: 'moon',
    name: '달',
    azimuth: moonPos.azimuth,
    altitude: moonPos.altitude,
    diameterDeg: discDegrees(MOON_RADIUS_KM, moonEq.dist * KM_PER_AU),
    sizeLabel: '',
    moonStage: stage.index,
    moonShapeDeg: stage.shapeDeg,
    limbRad: limb,
    active: moonPos.altitude > -0.8,
  };
  sun.sizeLabel = formatAngle(sun.diameterDeg);
  moon.sizeLabel = formatAngle(moon.diameterDeg);
  const icons: SkyIcon[] = [sun, moon];
  for (const planet of PLANETS) {
    const horizontal = skyPositionBody(planet.body, date, observer);
    const light = Illumination(planet.body, date);
    if (planet.body === Body.Uranus && light.mag > 6) continue;
    const diameter = discDegrees(PLANET_RADIUS_KM[planet.body] ?? 0, light.geo_dist * KM_PER_AU);
    icons.push({
      id: planet.kind,
      kind: planet.kind,
      name: planet.name,
      azimuth: horizontal.azimuth,
      altitude: horizontal.altitude,
      diameterDeg: diameter,
      sizeLabel: formatAngle(diameter),
      mag: light.mag,
      active: horizontal.altitude > 0,
    });
  }
  for (const star of BRIGHT_STARS) {
    const horizontal = horizontalFromEqj(date, rot, star.raHours * 15, star.dec);
    icons.push({
      id: `star-${star.name}`,
      kind: 'star',
      name: star.name,
      azimuth: horizontal.azimuth,
      altitude: horizontal.altitude,
      diameterDeg: 0,
      sizeLabel: '',
      mag: star.mag,
      active: horizontal.altitude > 0,
    });
  }
  const showers = showersOn(date);
  for (const shower of showers) {
    const horizontal = horizontalFromEqj(date, rot, shower.raDeg, shower.dec);
    icons.push({
      id: `meteor-${shower.name}`,
      kind: 'meteor',
      name: shower.name,
      azimuth: horizontal.azimuth,
      altitude: horizontal.altitude,
      diameterDeg: 0,
      sizeLabel: '',
      active: true,
    });
  }
  const now = date.getTime();
  for (const mark of marks) {
    icons.push({
      id: mark.id,
      kind: mark.kind,
      name: mark.name,
      azimuth: mark.azimuth,
      altitude: mark.altitude,
      diameterDeg: 0,
      sizeLabel: '',
      active: now >= mark.startMs && now < mark.endMs,
    });
  }
  const center = horizontalFromEqj(date, rot, galacticEquator(0, 0).ra, galacticEquator(0, 0).dec);
  icons.push({
    id: 'galaxy-center',
    kind: 'galaxy',
    name: '은하 중심',
    azimuth: center.azimuth,
    altitude: center.altitude,
    diameterDeg: 0,
    sizeLabel: '',
    active: center.altitude > 0,
  });
  return {
    icons,
    galaxy: galacticBand(date, rot),
    sun,
    moon,
    showers: showers.map((shower) => shower.name),
    marks,
  };
}

/** 은하 적도를 따라 고도를 구합니다. 원반이 아니라 띠의 중심선입니다. */
export function galacticBand(date: Date, rot: RotationMatrix): GalaxySample[] {
  const samples: GalaxySample[] = [];
  for (let lon = 0; lon < 360; lon += 6) {
    for (const lat of [-8, 0, 8]) {
      const eq = galacticEquator(lon, lat);
      const horizontal = horizontalFromEqj(date, rot, eq.ra, eq.dec);
      samples.push({ azimuth: horizontal.azimuth, altitude: horizontal.altitude, lon, lat });
    }
  }
  return samples;
}

export function galacticEquator(lonDeg: number, latDeg: number): { ra: number; dec: number } {
  const eqj = RotateVector(Rotation_GAL_EQJ(), VectorFromSphere(new Spherical(latDeg, lonDeg, 1), new Date()));
  const ra = (Math.atan2(eqj.y, eqj.x) * 180) / Math.PI;
  const dec = (Math.asin(eqj.z / Math.hypot(eqj.x, eqj.y, eqj.z)) * 180) / Math.PI;
  return { ra: (ra + 360) % 360, dec };
}

export function formatAngle(degrees: number): string {
  if (degrees >= 0.2) return `${degrees.toFixed(2)}°`;
  const minutes = degrees * 60;
  if (minutes >= 1) return `${minutes.toFixed(1)}′`;
  return `${(degrees * 3600).toFixed(0)}″`;
}

/** 해 각지름이 라이브러리 거리와 같은 반지름으로 나오는지 확인할 때 씁니다. */
export function sunDiameterDegrees(date: Date, lat: number, lng: number, elevationM: number): number {
  const observer = new Observer(lat, lng, elevationM);
  const sun = Equator(Body.Sun, date, observer, true, true);
  return discDegrees(SUN_RADIUS_KM, sun.dist * KM_PER_AU);
}

/** 달 각지름입니다. 지구 중심 값이 아니라 그 자리에서의 거리로 구합니다. */
export function moonDiameterDegrees(date: Date, lat: number, lng: number, elevationM: number): number {
  const observer = new Observer(lat, lng, elevationM);
  const moon = Equator(Body.Moon, date, observer, true, true);
  return discDegrees(MOON_RADIUS_KM, moon.dist * KM_PER_AU);
}

export function moonGeocentricDiameter(date: Date): number {
  return Libration(date).diam_deg;
}

function discDegrees(radiusKm: number, distanceKm: number): number {
  if (!(distanceKm > radiusKm)) return 0;
  return 2 * Math.asin(radiusKm / distanceKm) * (180 / Math.PI);
}

function skyPositionBody(body: Body, date: Date, observer: Observer): { azimuth: number; altitude: number } {
  const equatorial = Equator(body, date, observer, true, true);
  const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
  return { azimuth: horizontal.azimuth, altitude: horizontal.altitude };
}

function horizontalFromEqj(date: Date, rot: RotationMatrix, raDeg: number, decDeg: number): { azimuth: number; altitude: number } {
  const eqj = VectorFromSphere(new Spherical(decDeg, raDeg, 1), date);
  const horizontal = HorizonFromVector(RotateVector(rot, eqj), 'normal');
  return { azimuth: normalize(horizontal.lon), altitude: horizontal.lat };
}

function addInstant(
  marks: SkyMark[],
  id: string,
  kind: IconKind,
  name: string,
  time: Date | null,
  body: 'sun' | 'moon',
  lat: number,
  lng: number,
  elevationM: number,
): void {
  if (!time) return;
  const pos = skyPosition(body, time, lat, lng, elevationM);
  marks.push({
    id,
    kind,
    name,
    azimuth: pos.azimuth,
    altitude: pos.altitude,
    startMs: time.getTime() - 10 * 60 * 1000,
    endMs: time.getTime() + 10 * 60 * 1000,
  });
}

function addWindow(
  marks: SkyMark[],
  id: string,
  kind: IconKind,
  name: string,
  start: Date | null,
  end: Date | null,
  lat: number,
  lng: number,
  elevationM: number,
): void {
  if (!start || !end || end.getTime() <= start.getTime()) return;
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const pos = skyPosition('sun', mid, lat, lng, elevationM);
  marks.push({
    id,
    kind,
    name,
    azimuth: pos.azimuth,
    altitude: pos.altitude,
    startMs: start.getTime(),
    endMs: end.getTime(),
  });
}

function eventOnDay(result: { date: Date } | null, dayStart: Date, dayEnd: Date): Date | null {
  if (!result) return null;
  const time = result.date.getTime();
  if (time < dayStart.getTime() || time >= dayEnd.getTime()) return null;
  return result.date;
}

function inWindow(month: number, day: number, start: [number, number], end: [number, number]): boolean {
  const key = month * 100 + day;
  const from = start[0] * 100 + start[1];
  const to = end[0] * 100 + end[1];
  if (from <= to) return key >= from && key <= to;
  return key >= from || key <= to;
}

function direction(altitude: number, azimuth: number): { e: number; n: number; u: number } {
  const alt = (altitude * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;
  return {
    e: Math.cos(alt) * Math.sin(az),
    n: Math.cos(alt) * Math.cos(az),
    u: Math.sin(alt),
  };
}

function zenithAcross(forward: { e: number; n: number; u: number }): { e: number; n: number; u: number } {
  return { e: -forward.u * forward.e, n: -forward.u * forward.n, u: 1 - forward.u * forward.u };
}

function cross(
  a: { e: number; n: number; u: number },
  b: { e: number; n: number; u: number },
): { e: number; n: number; u: number } {
  return {
    e: a.n * b.u - a.u * b.n,
    n: a.u * b.e - a.e * b.u,
    u: a.e * b.n - a.n * b.e,
  };
}

function unit(value: { e: number; n: number; u: number }): { e: number; n: number; u: number } {
  const length = Math.hypot(value.e, value.n, value.u) || 1;
  return { e: value.e / length, n: value.n / length, u: value.u / length };
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
