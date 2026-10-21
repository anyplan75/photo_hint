import { bearingDegrees, distanceMeters } from './geo';

/** 풀프레임 센서입니다. 가로 36mm, 세로 24mm. */
export const SENSOR_WIDTH_MM = 36;
export const SENSOR_HEIGHT_MM = 24;
export const LENS_PRESETS = [24, 35, 50, 85, 135, 200] as const;

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
