import { bearingDegrees, distanceMeters } from './geo';

/** 풀프레임 센서입니다. 가로 36mm, 세로 24mm. 다른 센서를 고르면 그 가로·세로를 씁니다. */
export const SENSOR_WIDTH_MM = 36;
export const SENSOR_HEIGHT_MM = 24;
export const LENS_PRESETS = [24, 35, 50, 85, 135, 200] as const;
/** 프레임에 겹쳐 그리는 초점거리입니다. 화면은 켠 것 중 가장 넓은 화각입니다. */
export const FRAME_FOCALS = [24, 35, 50, 70, 85, 125, 200, 300, 400, 600] as const;
/** 화각선을 모두 껐을 때 쓰는 화면입니다. */
export const VIEW_FOCAL_MM = 24;

export type SensorId = 'full' | 'apsc' | 'canon' | 'm43' | 'inch';

/** 센서 크기입니다. 화각은 적힌 가로·세로(mm)로 구하고, 환산은 배율만 곱합니다. */
export interface CameraSensor {
  id: SensorId;
  name: string;
  widthMm: number;
  heightMm: number;
  crop: number;
}

export const CAMERA_SENSORS: readonly CameraSensor[] = [
  { id: 'full', name: '풀프레임', widthMm: 36, heightMm: 24, crop: 1 },
  { id: 'apsc', name: 'APS-C', widthMm: 23.5, heightMm: 15.6, crop: 1.5 },
  { id: 'canon', name: '캐논 APS-C', widthMm: 22.3, heightMm: 14.9, crop: 1.6 },
  { id: 'm43', name: '마이크로포서드', widthMm: 17.3, heightMm: 13, crop: 2 },
  { id: 'inch', name: '1인치', widthMm: 13.2, heightMm: 8.8, crop: 2.7 },
];

export function cameraSensor(id: string): CameraSensor {
  return CAMERA_SENSORS.find((item) => item.id === id) ?? CAMERA_SENSORS[0];
}

/** 프레임 오른쪽 아래에 적는 짧은 센서 문장입니다. */
export function formatSensorReadout(sensor: CameraSensor, viewMm: number, hFov: number, vFov: number): string {
  const equivalent = viewMm * sensor.crop;
  const eq = Math.abs(equivalent - Math.round(equivalent)) < 0.05 ? String(Math.round(equivalent)) : equivalent.toFixed(1);
  return `${sensor.name} ${sensor.crop.toFixed(1)}× · ${viewMm}mm · 환산 ${eq}mm · 가로 ${hFov.toFixed(2)}° · 세로 ${vFov.toFixed(2)}°`;
}

/** 해 표시·지도 선·테두리 아이콘이 같이 쓰는 색입니다. */
export const SUN_MARK_COLOR = '#f0c14a';
/** 달 표시·지도 선·테두리 아이콘이 같이 쓰는 색입니다. 해 색과 다릅니다. */
export const MOON_MARK_COLOR = '#8eb4ff';
/** 화각선입니다. 해·달 색을 쓰지 않습니다. */
export const FOV_LINE_COLOR = '#f4f7ef';
/** 지도와 AR에 항상 그리는 초점거리입니다. */
export const CAMERA_FOV_MM = [24, 50, 200, 400, 600] as const;

/** 켠 초점거리 중 가장 넓은 화각입니다. 없으면 24mm입니다. */
export function viewFocalMm(enabled: readonly number[]): number {
  const usable = enabled.filter((mm) => Number.isFinite(mm) && mm > 0);
  if (usable.length === 0) return VIEW_FOCAL_MM;
  return Math.min(...usable);
}

/** 지구 반지름(m). 시선이 땅의 굽음을 얼마나 피하는지 계산할 때 씁니다. */
const EARTH_RADIUS_M = 6371000;

export interface SightPlace {
  lat: number;
  lng: number;
  name: string | null;
}

export interface SightSample {
  t: number;
  distanceM: number;
  lat: number;
  lng: number;
}

export interface SightRidge {
  lat: number;
  lng: number;
  distanceM: number;
  elevationM: number;
  /** 시선보다 능선이 더 높은 높이(m)입니다. */
  excessM: number;
}

export interface SightProfile {
  samples: SightSample[];
  elevations: Array<number | null>;
  groundM: number;
  slantM: number;
  bearing: number;
  cameraAbs: number | null;
  subjectGround: number | null;
  subjectTop: number | null;
  aimAlt: number;
  blocked: boolean | null;
  ridge: SightRidge | null;
}

/** 8등신 하나의 비율입니다. 키만 받으면 어깨 너비까지 이 비율로 정합니다. */
export interface PersonShape {
  heightM: number;
  headM: number;
  headWidthM: number;
  shoulderM: number;
  hipM: number;
  /** 발바닥에서 어깨까지의 높이 */
  shoulderFromFeetM: number;
  /** 발바닥에서 엉덩이까지의 높이 */
  hipFromFeetM: number;
}

/** 렌즈 초점 거리와 센서 길이로 화각(도)을 구합니다. */
export function fieldOfView(focalMm: number, sensorMm: number): number {
  if (!(focalMm > 0) || !(sensorMm > 0)) return 0;
  return 2 * Math.atan(sensorMm / 2 / focalMm) * (180 / Math.PI);
}

/**
 * 물체의 보이는 각크기(도)입니다.
 * 각크기 = 2 × atan(물체 절반 길이 / 거리).
 */
export function angularDiameterDegrees(fullSizeM: number, distanceM: number): number {
  if (!(fullSizeM > 0) || !(distanceM > 0)) return 0;
  return 2 * Math.atan(fullSizeM / 2 / distanceM) * (180 / Math.PI);
}

/** 카메라에서 대상 중심까지의 직선 거리입니다. 지도 거리와 높이 차이를 함께 씁니다. */
export function slantMeters(groundM: number, cameraAbs: number, centerAbs: number): number {
  return Math.hypot(groundM, centerAbs - cameraAbs);
}

/** 카메라를 대상 중심에 둘 때의 고도(도)입니다. 위가 양수입니다. */
export function aimAltitudeDegrees(groundM: number, cameraAbs: number, centerAbs: number): number {
  if (!(groundM > 0)) return 0;
  return Math.atan2(centerAbs - cameraAbs, groundM) * (180 / Math.PI);
}

/**
 * 촬영 높이에서 본 지면의 고도각(도)입니다.
 * 지구가 굽어 먼 곳이 내려가므로, 그 굽음만큼 뺀 각입니다.
 */
export function apparentAltitudeDegrees(distanceM: number, elevationM: number, cameraAbs: number): number {
  if (!(distanceM > 0)) return 0;
  const drop = (distanceM * distanceM) / (2 * EARTH_RADIUS_M);
  return Math.atan2(elevationM - cameraAbs - drop, distanceM) * (180 / Math.PI);
}

export interface SkyBodyRim {
  azimuth: number;
  altitude: number;
}

export interface SkyRim {
  sun: SkyBodyRim;
  moon: SkyBodyRim;
}

/**
 * 방위가 지도 테두리와 만나는 점입니다.
 * 방위 0은 북쪽이고, 지도 베어링은 화면 위쪽이 가리키는 나침반 방향입니다.
 */
export function rimPoint(
  azimuthDeg: number,
  mapBearingDeg: number,
  width: number,
  height: number,
  inset: number,
): { x: number; y: number } {
  const relative = ((azimuthDeg - mapBearingDeg) % 360 + 360) % 360;
  const radians = (relative * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const halfW = Math.max(1, width / 2 - inset);
  const halfH = Math.max(1, height / 2 - inset);
  const scaleX = Math.abs(dx) < 1e-6 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const scaleY = Math.abs(dy) < 1e-6 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return { x: width / 2 + dx * scale, y: height / 2 + dy * scale };
}

/** 보는 방향에서 대상 방위가 얼마나 왼쪽·오른쪽인지입니다. 오른쪽이 양수입니다. */
export function azimuthOffset(bearingDeg: number, targetDeg: number): number {
  return ((((targetDeg - bearingDeg) % 360) + 540) % 360) - 180;
}

export function inLensFrame(
  offsetDeg: number,
  altitudeDeg: number,
  centerAltDeg: number,
  horizontalFov: number,
  verticalFov: number,
): boolean {
  return Math.abs(offsetDeg) <= horizontalFov / 2 && Math.abs(altitudeDeg - centerAltDeg) <= verticalFov / 2;
}

/** 프레임 밖이면 어느 쪽으로 몇 도인지 말합니다. */
export function framePhrase(
  offsetDeg: number,
  altitudeDeg: number,
  centerAltDeg: number,
  horizontalFov: number,
  verticalFov: number,
): string {
  const relAlt = altitudeDeg - centerAltDeg;
  const outH = Math.abs(offsetDeg) > horizontalFov / 2;
  const outV = Math.abs(relAlt) > verticalFov / 2;
  if (!outH && !outV) return '프레임 안';
  const parts: string[] = [];
  if (outH) parts.push(`${offsetDeg >= 0 ? '오른쪽' : '왼쪽'} ${Math.abs(offsetDeg).toFixed(0)}°`);
  if (outV) parts.push(`${relAlt >= 0 ? '위' : '아래'} ${Math.abs(relAlt).toFixed(0)}°`);
  if (altitudeDeg < -0.5) parts.push(`지평선 아래 ${Math.abs(altitudeDeg).toFixed(0)}°`);
  return `${parts.join(' · ')} 밖`;
}

export interface BodyCue {
  inside: boolean;
  blocked: boolean;
  text: string;
  offsetDeg: number;
  relAlt: number;
}

/** 프레임 안이면 이름, 능선에 가리면 그 말을 붙이고, 밖이면 방향과 각도를 적습니다. */
export function skyBodyCue(
  name: string,
  azimuth: number,
  altitude: number,
  bearing: number,
  centerAlt: number,
  hFov: number,
  vFov: number,
  skyline: readonly { offsetDeg: number; altitude: number | null }[] | null,
  ridgeBearing = bearing,
): BodyCue {
  const offsetDeg = azimuthOffset(bearing, azimuth);
  const relAlt = altitude - centerAlt;
  const inside = inLensFrame(offsetDeg, altitude, centerAlt, hFov, vFov);
  const blocked = ridgeHides(azimuthOffset(ridgeBearing, azimuth), altitude, skyline);
  const where = inside ? name : offFrameText(name, offsetDeg, relAlt, hFov, vFov);
  return { inside, blocked, text: blocked ? `${where} 능선에 가림` : where, offsetDeg, relAlt };
}

function ridgeHides(
  offsetDeg: number,
  altitude: number,
  skyline: readonly { offsetDeg: number; altitude: number | null }[] | null,
): boolean {
  if (!skyline || skyline.length === 0) return false;
  let best: { offsetDeg: number; altitude: number | null } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const column of skyline) {
    const dist = Math.abs(column.offsetDeg - offsetDeg);
    if (dist < bestDist) {
      best = column;
      bestDist = dist;
    }
  }
  if (!best || best.altitude === null || bestDist > 1.5) return false;
  return altitude < best.altitude;
}

function offFrameText(name: string, offsetDeg: number, relAlt: number, hFov: number, vFov: number): string {
  const parts: string[] = [];
  if (Math.abs(offsetDeg) > hFov / 2) parts.push(`${offsetDeg >= 0 ? '오른쪽' : '왼쪽'} ${Math.abs(offsetDeg).toFixed(0)}°`);
  if (Math.abs(relAlt) > vFov / 2) parts.push(`${relAlt >= 0 ? '위' : '아래'} ${Math.abs(relAlt).toFixed(0)}°`);
  return parts.length === 0 ? name : `${name} ${parts.join(' · ')}`;
}

export function personShape(heightM: number): PersonShape {
  const head = heightM / 8;
  const headWidth = head * 0.72;
  return {
    heightM,
    headM: head,
    headWidthM: headWidth,
    shoulderM: headWidth * 2.2,
    hipM: headWidth * 1.7,
    shoulderFromFeetM: heightM - head * 1.5,
    hipFromFeetM: heightM * 0.5,
  };
}

/** 두 점 사이를 일정 간격으로 나눕니다. 고도를 읽을 자리입니다. */
export function sightSamples(from: { lat: number; lng: number }, to: { lat: number; lng: number }): SightSample[] {
  const ground = distanceMeters(from.lat, from.lng, to.lat, to.lng);
  const count = Math.min(160, Math.max(24, Math.round(ground / 40)));
  const samples: SightSample[] = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const point = pointOnSphere(from, to, t);
    samples.push({ t, distanceM: ground * t, lat: point.lat, lng: point.lng });
  }
  return samples;
}

/**
 * 고도 배열로 능선이 시선을 막는지 판단합니다.
 * 고도가 없으면 막힘을 짐작하지 않습니다.
 * 직선은 지구가 휘어 중간 지점이 살짝 내려가므로, 그 굽음만 빼서 비교합니다.
 */
export function analyzeProfile(args: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  elevations: Array<number | null> | null;
  cameraHeightM: number;
  subjectHeightM: number;
}): SightProfile {
  const samples = sightSamples(args.from, args.to);
  const groundM = samples.length > 0 ? samples[samples.length - 1].distanceM : 0;
  const bearing = bearingDegrees(args.from.lat, args.from.lng, args.to.lat, args.to.lng);
  const known = args.elevations !== null && args.elevations.length === samples.length && args.elevations.every((item) => item !== null);
  if (!known || !args.elevations) {
    const cameraAbs = args.cameraHeightM;
    const centerAbs = args.subjectHeightM / 2;
    return {
      samples,
      elevations: args.elevations ?? samples.map(() => null),
      groundM,
      slantM: slantMeters(groundM, cameraAbs, centerAbs),
      bearing,
      cameraAbs: null,
      subjectGround: null,
      subjectTop: null,
      aimAlt: aimAltitudeDegrees(groundM, cameraAbs, centerAbs),
      blocked: null,
      ridge: null,
    };
  }
  const elevations = args.elevations as number[];
  const cameraAbs = elevations[0] + args.cameraHeightM;
  const subjectGround = elevations[elevations.length - 1];
  const subjectTop = subjectGround + args.subjectHeightM;
  const centerAbs = subjectGround + args.subjectHeightM / 2;
  let ridge: SightRidge | null = null;
  for (let index = 1; index < samples.length - 1; index += 1) {
    const sample = samples[index];
    const chord = chordElevation(cameraAbs, subjectTop, sample.distanceM, groundM);
    const excess = elevations[index] - chord;
    if (excess > 1 && (!ridge || excess > ridge.excessM)) {
      ridge = {
        lat: sample.lat,
        lng: sample.lng,
        distanceM: sample.distanceM,
        elevationM: elevations[index],
        excessM: excess,
      };
    }
  }
  return {
    samples,
    elevations,
    groundM,
    slantM: slantMeters(groundM, cameraAbs, centerAbs),
    bearing,
    cameraAbs,
    subjectGround,
    subjectTop,
    aimAlt: aimAltitudeDegrees(groundM, cameraAbs, centerAbs),
    blocked: ridge !== null,
    ridge,
  };
}

/** 거리-높이 그림에서 카메라와 대상 머리를 잇는 선의 높이입니다. */
export function chordElevation(cameraAbs: number, subjectTop: number, distanceM: number, groundM: number): number {
  if (!(groundM > 0)) return cameraAbs;
  const linear = cameraAbs + (distanceM / groundM) * (subjectTop - cameraAbs);
  const drop = (distanceM * (groundM - distanceM)) / (2 * EARTH_RADIUS_M);
  return linear - drop;
}

/** 맵박스 지형 타일의 빨강·초록·파랑을 미터 높이로 바꿉니다. */
export function elevationFromRgb(red: number, green: number, blue: number): number {
  return -10000 + (red * 65536 + green * 256 + blue) * 0.1;
}

export interface SkylineProbe {
  offsetDeg: number;
  distanceM: number;
  lat: number;
  lng: number;
}

export interface SkylineColumn {
  offsetDeg: number;
  /** 대상보다 멀거나 같은 지면 중 가장 높은 고도각. 읽지 못한 방향은 null입니다. */
  altitude: number | null;
  /** 대상 거리의 지면 고도각. 그 칸을 못 읽으면 null입니다. */
  groundAlt: number | null;
  /** 대상보다 앞에서 머리보다 높은 능선. 없으면 null입니다. */
  occludeAlt: number | null;
}

/** 지도 화각선과 AR이 시선 도구와 나눠 쓰는 화면 설정입니다. */
export interface SightOptics {
  sensor: CameraSensor;
  frames: number[];
  bearing: number | null;
  sightAlt: number;
  elevationM: number;
  skyline: SkylineColumn[];
}

/** 24mm 화면을 가로지르는 고도 표본입니다. 작가 위치는 거리 0입니다. */
export function skylineProbes(
  from: { lat: number; lng: number },
  bearingDeg: number,
  hFovDeg: number,
  subjectDistanceM: number,
): SkylineProbe[] {
  const reach = Math.min(16000, Math.max(subjectDistanceM * 2.2, 8000));
  const probes: SkylineProbe[] = [{ offsetDeg: 0, distanceM: 0, lat: from.lat, lng: from.lng }];
  for (const offsetDeg of viewOffsets(hFovDeg)) {
    const heading = bearingDeg + offsetDeg;
    for (const distanceM of rayDistances(subjectDistanceM, reach)) {
      const point = pointFromBearing(from.lat, from.lng, heading, distanceM);
      probes.push({ offsetDeg, distanceM, lat: point.lat, lng: point.lng });
    }
  }
  return probes;
}

/** 읽은 높이를 방향별 능선으로 모읍니다. 빈 높이는 이웃으로 메우지 않습니다. */
export function assembleSkyline(args: {
  probes: SkylineProbe[];
  elevations: Array<number | null>;
  profileSamples: SightSample[] | null;
  profileElevations: Array<number | null> | null;
  cameraAbs: number | null;
  subjectDistanceM: number;
  subjectHeightDeg: number;
}): SkylineColumn[] {
  if (args.cameraAbs === null) return [];
  const grouped = new Map<number, { distanceM: number; elevationM: number | null }[]>();
  args.probes.forEach((probe, index) => {
    if (!(probe.distanceM > 1)) return;
    const bucket = grouped.get(probe.offsetDeg) ?? [];
    bucket.push({ distanceM: probe.distanceM, elevationM: args.elevations[index] ?? null });
    grouped.set(probe.offsetDeg, bucket);
  });
  const center = grouped.get(0) ?? [];
  if (args.profileSamples && args.profileElevations && args.profileSamples.length === args.profileElevations.length) {
    args.profileSamples.forEach((sample, index) => {
      center.push({ distanceM: sample.distanceM, elevationM: args.profileElevations?.[index] ?? null });
    });
  }
  grouped.set(0, center);
  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offsetDeg, samples]) => columnFromSamples(offsetDeg, samples, args.cameraAbs as number, args.subjectDistanceM, args.subjectHeightDeg));
}

function columnFromSamples(
  offsetDeg: number,
  samples: { distanceM: number; elevationM: number | null }[],
  cameraAbs: number,
  subjectDistanceM: number,
  subjectHeightDeg: number,
): SkylineColumn {
  const known = samples.filter((sample): sample is { distanceM: number; elevationM: number } => sample.elevationM !== null && sample.distanceM > 1);
  if (known.length === 0) return { offsetDeg, altitude: null, groundAlt: null, occludeAlt: null };
  let ground: { distanceM: number; elevationM: number } | null = null;
  for (const sample of known) {
    if (!ground || Math.abs(sample.distanceM - subjectDistanceM) <= Math.abs(ground.distanceM - subjectDistanceM)) ground = sample;
  }
  const groundClose = ground !== null && Math.abs(ground.distanceM - subjectDistanceM) <= Math.max(40, subjectDistanceM * 0.08);
  const groundAlt = groundClose && ground ? apparentAltitudeDegrees(ground.distanceM, ground.elevationM, cameraAbs) : null;
  let altitude: number | null = null;
  let occludeAlt: number | null = null;
  const headAlt = groundAlt === null ? null : groundAlt + subjectHeightDeg;
  for (const sample of known) {
    const alt = apparentAltitudeDegrees(sample.distanceM, sample.elevationM, cameraAbs);
    if (sample.distanceM >= subjectDistanceM * 0.98 && (altitude === null || alt > altitude)) altitude = alt;
    if (headAlt !== null && sample.distanceM < subjectDistanceM * 0.97 && alt > headAlt && (occludeAlt === null || alt > occludeAlt)) occludeAlt = alt;
  }
  return { offsetDeg, altitude, groundAlt, occludeAlt };
}

function viewOffsets(hFovDeg: number): number[] {
  const edge = Math.max(0, hFovDeg / 2);
  const step = edge > 20 ? 2 : edge > 8 ? 1 : 0.5;
  const offsets = new Set<number>([0, roundMilli(-edge), roundMilli(edge)]);
  const count = Math.floor(edge / step);
  for (let index = 1; index <= count; index += 1) {
    const value = roundMilli(step * index);
    if (value < edge - 1e-6) {
      offsets.add(-value);
      offsets.add(value);
    }
  }
  return [...offsets].sort((a, b) => a - b);
}

function roundMilli(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function rayDistances(subjectM: number, reachM: number): number[] {
  const distances = new Set<number>([subjectM]);
  const nearEnd = Math.min(subjectM * 0.9, reachM);
  for (let index = 1; index <= 7; index += 1) {
    const distance = 100 + ((nearEnd - 100) * index) / 8;
    if (distance > 40 && distance < subjectM * 0.97) distances.add(distance);
  }
  let far = subjectM * 1.25;
  while (far < reachM) {
    distances.add(far);
    far *= 1.4;
  }
  if (reachM > subjectM * 1.05) distances.add(reachM);
  return [...distances].sort((a, b) => a - b);
}

export function pointFromBearing(lat: number, lng: number, bearingDeg: number, distanceM: number): { lat: number; lng: number } {
  if (!(distanceM > 0)) return { lat, lng };
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lng * Math.PI) / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return { lat: (phi2 * 180) / Math.PI, lng: ((((lambda2 * 180) / Math.PI) + 540) % 360) - 180 };
}

function pointOnSphere(from: { lat: number; lng: number }, to: { lat: number; lng: number }, t: number): { lat: number; lng: number } {
  const φ1 = (from.lat * Math.PI) / 180;
  const λ1 = (from.lng * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const λ2 = (to.lng * Math.PI) / 180;
  const delta = 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
  )));
  if (delta === 0) return { lat: from.lat, lng: from.lng };
  const a = Math.sin((1 - t) * delta) / Math.sin(delta);
  const b = Math.sin(t * delta) / Math.sin(delta);
  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);
  return {
    lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    lng: (Math.atan2(y, x) * 180) / Math.PI,
  };
}
