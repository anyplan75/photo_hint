import type { NearbyKind } from './nearby';
import { lightBody, type Composition, type WindowKind } from './places';
import { skyPosition, type DaySky, type SkyPoint } from './sky';
import { formatClock, formatRange } from './time';
import { sampleTime, shotWindow, type TimeWindow } from './windows';

const COMPASS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const;

export type SpotKind = 'here' | NearbyKind;

export interface TrackPoint {
  label: string;
  time: Date;
  azimuth: number;
  altitude: number;
  note: string;
}

export interface MoonGuide {
  phaseName: string;
  litFraction: number;
  rise: SkyPoint | null;
  set: SkyPoint | null;
  afterRise: SkyPoint | null;
  summary: string;
}

export interface ShootIdea {
  id: string;
  composition: Composition;
  window: WindowKind;
  title: string;
  summary: string;
  detail: string;
  frame: string;
}

export interface SpotGuide {
  track: TrackPoint[];
  dayLine: string;
  moon: MoonGuide;
  ideas: ShootIdea[];
}

export function compassName(azimuth: number): string {
  const index = Math.round(normalize(azimuth) / 45) % 8;
  return COMPASS[index];
}

export function formatPosition(point: SkyPoint | null): string {
  if (!point) return '없음';
  return `방위 ${showAzimuth(point.azimuth)}°(${compassName(point.azimuth)}) · 고도 ${point.altitude.toFixed(1)}°`;
}

export function buildSpotGuide(input: {
  name: string;
  kind: SpotKind;
  lat: number;
  lng: number;
  elevationM: number;
  sky: DaySky;
  phaseName: string;
}): SpotGuide {
  const { lat, lng, elevationM, sky, name } = input;
  const track = sunTrack(lat, lng, elevationM, sky);
  const noon = highestSun(lat, lng, elevationM, sky);
  const rise = pointAt('sun', sky.sunrise, lat, lng, elevationM);
  const set = pointAt('sun', sky.sunset, lat, lng, elevationM);
  const dayLine = daySentence(name, rise, set, noon);
  const moon = moonGuide(input);
  const ideas = [
    sunriseAlignment(input, rise),
    sunsetSilhouette(input, set),
    goldenReflection(input),
    blueFrame(input, set),
    moonAlignment(input, moon),
  ].filter((idea): idea is ShootIdea => idea !== null);

  return { track, dayLine, moon, ideas };
}

export function positionOn(body: 'sun' | 'moon', date: Date | null, lat: number, lng: number, elevationM: number): SkyPoint | null {
  return pointAt(body, date, lat, lng, elevationM);
}

function sunTrack(lat: number, lng: number, elevationM: number, sky: DaySky): TrackPoint[] {
  const rows: Array<[string, Date | null]> = [
    ['아침 블루아워', sky.blueMorningStart],
    ['일출', sky.sunrise],
    ['아침 골든아워 끝', sky.goldenMorningEnd],
    ['한낮', highestSun(lat, lng, elevationM, sky)?.time ?? null],
    ['저녁 골든아워', sky.goldenEveningStart],
    ['일몰', sky.sunset],
    ['저녁 블루아워 끝', sky.blueEveningEnd],
  ];
  return rows.flatMap(([label, time]) => {
    const point = pointAt('sun', time, lat, lng, elevationM);
    if (!time || !point) return [];
    return [{ label, time, azimuth: point.azimuth, altitude: point.altitude, note: lightNote(point) }];
  });
}

function moonGuide(input: {
  name: string;
  lat: number;
  lng: number;
  elevationM: number;
  sky: DaySky;
  phaseName: string;
}): MoonGuide {
  const { lat, lng, elevationM, sky, phaseName, name } = input;
  const rise = pointAt('moon', sky.moonrise, lat, lng, elevationM);
  const set = pointAt('moon', sky.moonset, lat, lng, elevationM);
  const after = sky.moonrise ? new Date(sky.moonrise.getTime() + 20 * 60 * 1000) : null;
  const afterRise = pointAt('moon', after, lat, lng, elevationM);
  const sunSet = pointAt('sun', sky.sunset, lat, lng, elevationM);
  const share =
    rise && sunSet && smallestAngle(rise.azimuth, sunSet.azimuth) <= 25
      ? ` 일몰과 방향 차이가 ${Math.round(smallestAngle(rise.azimuth, sunSet.azimuth))}°라 같은 쪽 하늘에 가깝습니다.`
      : '';
  const riseText = sky.moonrise && rise ? `월출 ${formatClock(sky.moonrise)}, ${formatPosition(rise)}.` : '이 날 월출은 없습니다.';
  const setText = sky.moonset && set ? ` 월몰 ${formatClock(sky.moonset)}, ${formatPosition(set)}.` : ' 이 날 월몰은 없습니다.';
  const lowText =
    after && afterRise
      ? ` 뜬 뒤 20분(${formatClock(after)})에는 ${formatPosition(afterRise)}로, 아직 낮게 있습니다.`
      : '';
  return {
    phaseName,
    litFraction: sky.moonLitFraction,
    rise,
    set,
    afterRise,
    summary: `${name}에서 달은 ${phaseName}, 밝기 ${Math.round(sky.moonLitFraction * 100)}%입니다. ${riseText}${setText}${lowText}${share}`,
  };
}

function sunriseAlignment(
  input: { name: string; kind: SpotKind; lat: number; lng: number; elevationM: number; sky: DaySky },
  rise: SkyPoint | null,
): ShootIdea | null {
  const window = shotWindow('sunrise-20', input.sky);
  if (!window || !input.sky.sunrise || !rise) return null;
  const sample = atWindow('sunrise-20', window, input);
  const stand =
    input.kind === 'viewpoint'
      ? '전망이 열리는 쪽으로 발을 두고, 해가 그 시선과 겹치는 높이에서 고정합니다.'
      : input.kind === 'peak'
        ? '능선이 열리는 쪽으로 돌아 해를 능선 위에 올립니다.'
        : '그 방위를 마주 보고 섭니다. 해를 수평선 부근, 화면의 한 세로선에 올려 앞의 선과 맞춥니다.';
  return idea(input, {
    composition: 'alignment',
    window: 'sunrise-20',
    title: '일출 방향으로 맞추기',
    summary: `${input.name}에서 해가 뜨는 쪽은 ${compassName(rise.azimuth)}입니다. 뜬 뒤 20분만 해가 지평선에 붙어 있습니다.`,
    detail: `일출 ${formatClock(input.sky.sunrise)}, ${formatPosition(rise)}. 창 ${formatRange(window.start, window.end)}의 해는 ${formatPosition(sample)}.`,
    frame: stand,
  });
}

function sunsetSilhouette(
  input: { name: string; kind: SpotKind; lat: number; lng: number; elevationM: number; sky: DaySky },
  set: SkyPoint | null,
): ShootIdea | null {
  const window = shotWindow('sunset-20', input.sky);
  if (!window || !input.sky.sunset || !set) return null;
  const sample = atWindow('sunset-20', window, input);
  const stand =
    input.kind === 'peak'
      ? '그 방위의 능선이나 봉우리 윤곽을 검게 세웁니다. 하늘은 위쪽 3분의 2를 비웁니다.'
      : input.kind === 'bridge'
        ? '교각이나 난간을 그 방위의 하늘에 검게 두고, 해는 구조물 바로 옆이나 사이에 둡니다.'
        : '그 방위에 선 사람이나 나무 끝을 검게 두고 해와 겹치거나 바로 옆에 둡니다. 노출은 하늘에 맞춥니다.';
  return idea(input, {
    composition: 'silhouette',
    window: 'sunset-20',
    title: '낮은 역광의 실루엣',
    summary: `해가 지기 전 20분, ${compassName(set.azimuth)}쪽 하늘만 낮고 따뜻합니다.`,
    detail: `일몰 ${formatClock(input.sky.sunset)}, ${formatPosition(set)}. 창 ${formatRange(window.start, window.end)}의 해는 ${formatPosition(sample)}.`,
    frame: stand,
  });
}

function goldenReflection(input: {
  name: string;
  kind: SpotKind;
  lat: number;
  lng: number;
  elevationM: number;
  sky: DaySky;
}): ShootIdea | null {
  const evening = shotWindow('evening-golden', input.sky);
  const morning = shotWindow('morning-golden', input.sky);
  const window = evening ?? morning;
  const kind = evening ? 'evening-golden' : 'morning-golden';
  if (!window) return null;
  const sample = atWindow(kind, window, input);
  if (!sample) return null;
  const water = input.kind === 'lake';
  return idea(input, {
    composition: 'reflection',
    window: kind,
    title: water ? '수면에 잇는 낮은 빛' : '낮은 빛을 아래에 받기',
    summary: water
      ? `호수가 있는 자리입니다. ${kind === 'evening-golden' ? '저녁' : '아침'} 골든아워의 해를 수면으로 내립니다.`
      : `가까운 호수가 아니어도, 젖은 바닥이나 유리에 그 방위의 낮은 해를 받을 수 있습니다.`,
    detail: `골든아워 ${formatRange(window.start, window.end)}. 이 구간의 해는 ${formatPosition(sample)}.`,
    frame: water
      ? `수면이 화면 아래 절반이 되게 카메라를 낮춥니다. 방위 ${showAzimuth(sample.azimuth)}°의 빛이 물 위로 이어지게 수평을 맞춥니다.`
      : `비치는 면을 화면 아래에 두고 방위 ${showAzimuth(sample.azimuth)}°의 해를 그 면에 담습니다. 수면이 아니면 반영은 짧게 끊깁니다.`,
  });
}

function blueFrame(
  input: { name: string; kind: SpotKind; lat: number; lng: number; elevationM: number; sky: DaySky },
  set: SkyPoint | null,
): ShootIdea | null {
  const evening = shotWindow('evening-blue', input.sky);
  const morning = shotWindow('morning-blue', input.sky);
  const window = evening ?? morning;
  const kind = evening ? 'evening-blue' : 'morning-blue';
  if (!window) return null;
  const edge = kind === 'evening-blue' ? input.sky.blueEveningEnd : input.sky.blueMorningStart;
  const edgePoint = pointAt('sun', edge, input.lat, input.lng, input.elevationM);
  const toward = set ? `하늘이 남는 쪽은 일몰 방위 ${showAzimuth(set.azimuth)}°(${compassName(set.azimuth)})입니다.` : '밝은 하늘 쪽으로 틈을 맞춥니다.';
  const stand =
    input.kind === 'bridge'
      ? '난간, 케이블, 교각 사이로 그 방위의 하늘을 사각형에 넣습니다. 다리는 기울이지 않습니다.'
      : input.kind === 'park'
        ? '가지 사이로 그 방위의 하늘만 남깁니다. 잎이 가장자리를 만들고 가운데는 비웁니다.'
        : `문, 창, 나뭇가지처럼 가까운 틈으로 ${set ? `방위 ${showAzimuth(set.azimuth)}°의 ` : ''}하늘을 가둡니다.`;
  return idea(input, {
    composition: 'frame',
    window: kind,
    title: input.kind === 'bridge' ? '다리로 하늘을 가두기' : '앞의 틈으로 하늘 가두기',
    summary: `블루아워 ${formatRange(window.start, window.end)} 동안만 하늘색이 남습니다. ${toward}`,
    detail: edgePoint ? `블루아워 끝의 해는 ${formatPosition(edgePoint)}.` : '이 구간의 해는 지평선 아래에 있습니다.',
    frame: stand,
  });
}

function moonAlignment(
  input: { name: string; kind: SpotKind; lat: number; lng: number; elevationM: number; sky: DaySky },
  moon: MoonGuide,
): ShootIdea | null {
  const window = shotWindow('moon-40', input.sky);
  if (!window || !input.sky.moonrise || !moon.rise) return null;
  const sample = atWindow('moon-40', window, input);
  return idea(input, {
    composition: 'alignment',
    window: 'moon-40',
    title: '낮게 뜬 달과 맞추기',
    summary: `${moon.phaseName}, 밝기 ${Math.round(moon.litFraction * 100)}%. 뜬 뒤 40분만 달이 낮습니다.`,
    detail: `월출 ${formatClock(input.sky.moonrise)}, ${formatPosition(moon.rise)}. 창 ${formatRange(window.start, window.end)}의 달은 ${formatPosition(sample)}.${moon.afterRise ? ` 20분 뒤에는 ${formatPosition(moon.afterRise)}.` : ''}`,
    frame: '달이 낮은 동안 그 방위를 봅니다. 달과 앞의 수직선(나무, 기둥, 사람)을 한 줄에 올립니다.',
  });
}

function idea(
  input: { lat: number; lng: number },
  fields: Omit<ShootIdea, 'id'>,
): ShootIdea {
  return {
    id: `${input.lat.toFixed(4)},${input.lng.toFixed(4)}:${fields.composition}:${fields.window}`,
    ...fields,
  };
}

function atWindow(
  kind: WindowKind,
  window: TimeWindow,
  input: { lat: number; lng: number; elevationM: number },
): SkyPoint | null {
  return pointAt(lightBody(kind), sampleTime(kind, window), input.lat, input.lng, input.elevationM);
}

function pointAt(
  body: 'sun' | 'moon',
  date: Date | null,
  lat: number,
  lng: number,
  elevationM: number,
): SkyPoint | null {
  if (!date) return null;
  return skyPosition(body, date, lat, lng, elevationM);
}

function highestSun(
  lat: number,
  lng: number,
  elevationM: number,
  sky: DaySky,
): { time: Date; azimuth: number; altitude: number } | null {
  if (!sky.sunrise || !sky.sunset) return null;
  let best: { time: Date; azimuth: number; altitude: number } | null = null;
  for (let time = sky.sunrise.getTime(); time <= sky.sunset.getTime(); time += 10 * 60 * 1000) {
    const point = skyPosition('sun', new Date(time), lat, lng, elevationM);
    if (!best || point.altitude > best.altitude) best = { time: new Date(time), ...point };
  }
  return best;
}

function daySentence(name: string, rise: SkyPoint | null, set: SkyPoint | null, noon: { azimuth: number; altitude: number } | null): string {
  if (!rise || !set) return `${name}에서는 이 날의 일출이나 일몰이 없습니다.`;
  const noonText = noon ? ` 한낮에는 방위 ${showAzimuth(noon.azimuth)}°, 고도 ${noon.altitude.toFixed(1)}°까지 올라갑니다.` : '';
  return `${name}에서 해는 ${compassName(rise.azimuth)}에서 떠서 ${compassName(set.azimuth)}로 집니다.${noonText}`;
}

function lightNote(point: SkyPoint): string {
  const dir = `${compassName(point.azimuth)}쪽`;
  if (point.altitude < 0) return `${dir}, 지평선 아래`;
  if (point.altitude < 6) return `${dir}에서 지평선에 붙은 빛`;
  if (point.altitude < 15) return `${dir}의 낮은 빛`;
  if (point.altitude < 40) return `${dir}에서 비스듬히 들어오는 빛`;
  return `${dir}, 높은 빛`;
}

export function smallestAngle(a: number, b: number): number {
  const diff = Math.abs(normalize(a) - normalize(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function showAzimuth(degrees: number): number {
  return Math.round(normalize(degrees)) % 360;
}

