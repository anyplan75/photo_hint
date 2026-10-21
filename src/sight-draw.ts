import {
  angularDiameterDegrees,
  fieldOfView,
  SENSOR_HEIGHT_MM,
  SENSOR_WIDTH_MM,
  type PersonShape,
  type SightProfile,
  type SkylineColumn,
} from './sightline';
import { moonLit, type GalaxySample, type SkyIcon, type SkyScene } from './sky-scene';

export interface FrameMetrics {
  subjectPx: number;
  moonPx: number;
  sunPx: number;
  pxPerDeg: number;
}

export interface FrameSubject {
  kind: 'person' | 'object';
  heightDeg: number;
  widthDeg: number;
  distanceM: number;
  shape: PersonShape | null;
  hidden: boolean;
  /** 발이 닿는 지면의 고도각. 지면을 못 읽으면 null입니다. */
  feetAlt: number | null;
}

/** 렌즈 프레임입니다. 한 각크기 비율로 대상·해·달을 놓습니다. */
export function drawLensFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hFov: number,
  vFov: number,
  centerAlt: number,
  bearing: number,
  subject: FrameSubject | null,
  scene: SkyScene | null,
  skyline: SkylineColumn[] | null,
  focals: number[],
): FrameMetrics {
  const pxPerDeg = hFov > 0 && vFov > 0 ? Math.min(width / hFov, height / vFov) : 1;
  const frameW = hFov * pxPerDeg;
  const frameH = vFov * pxPerDeg;
  const left = (width - frameW) / 2;
  const top = (height - frameH) / 2;
  ctx.clearRect(0, 0, width, height);
  const sunAlt = scene?.sun.altitude ?? -90;
  ctx.fillStyle = skyFill(sunAlt);
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(left, top);
  width = frameW;
  height = frameH;
  const horizon = height / 2 - (0 - centerAlt) * pxPerDeg;
  if (horizon > 0 && horizon < height) {
    ctx.strokeStyle = 'rgba(237, 242, 230, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    ctx.stroke();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  if (scene) {
    drawGalaxy(ctx, scene.galaxy, bearing, centerAlt, pxPerDeg, width, height, 16);
    for (const icon of scene.icons) {
      if (icon.kind === 'sun' || icon.kind === 'moon') continue;
      drawIcon(ctx, icon, bearing, centerAlt, pxPerDeg, width, height, true);
    }
    if (scene.sun) drawDisc(ctx, scene.sun, bearing, centerAlt, pxPerDeg, width, height);
    if (scene.moon) drawDisc(ctx, scene.moon, bearing, centerAlt, pxPerDeg, width, height);
  }
  if (skyline && skyline.length > 1) drawSkyline(ctx, width, height, centerAlt, pxPerDeg, skyline, false);
  let subjectPx = 0;
  if (subject && subject.heightDeg > 0) {
    subjectPx = subject.heightDeg * pxPerDeg;
    const bodyCenterAlt = subject.feetAlt === null ? centerAlt : subject.feetAlt + subject.heightDeg / 2;
    const cy = height / 2 - (bodyCenterAlt - centerAlt) * pxPerDeg;
    drawSubject(ctx, width / 2, cy, pxPerDeg, subject);
  }
  if (skyline && skyline.length > 1) drawSkyline(ctx, width, height, centerAlt, pxPerDeg, skyline, true);
  ctx.restore();
  drawBrackets(ctx, width, height);
  drawFocalFrames(ctx, width, height, hFov, vFov, focals);
  ctx.restore();
  const moonPx = (scene?.moon.diameterDeg ?? 0) * pxPerDeg;
  const sunPx = (scene?.sun.diameterDeg ?? 0) * pxPerDeg;
  return { subjectPx, moonPx, sunPx, pxPerDeg };
}

/** 프레임 밖 자리도 빠지지 않게 방위만 펼친 띠입니다. 크기의 기준은 프레임입니다. */
export function drawSkyStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bearing: number,
  scene: SkyScene | null,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, width, height);
  const mid = height * 0.62;
  ctx.strokeStyle = 'rgba(237, 242, 230, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
  ctx.fillStyle = '#9eb5bd';
  ctx.font = '11px "Noto Sans KR", sans-serif';
  ctx.fillText('하늘 띠', 8, 14);
  if (!scene) return;
  const xOf = (azimuth: number) => {
    const offset = wrap(azimuth - bearing);
    return width / 2 + (offset / 180) * (width / 2 - 8);
  };
  const yOf = (altitude: number) => mid - Math.max(-28, Math.min(55, altitude)) * 0.45;
  drawGalaxy(ctx, scene.galaxy, bearing, 0, (width - 16) / 360, width, height, 10, true);
  for (const icon of scene.icons) {
    const x = xOf(icon.azimuth);
    const y = Math.max(16, Math.min(height - 8, yOf(icon.altitude)));
    drawGlyph(ctx, icon, x, y, icon.kind === 'sun' || icon.kind === 'moon' ? 7 : 6, false);
  }
}

/** 카메라, 지면, 대상 머리, 능선을 거리-높이로 그립니다. */
export function drawProfile(ctx: CanvasRenderingContext2D, width: number, height: number, profile: SightProfile | null): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#9eb5bd';
  ctx.font = '11px "Noto Sans KR", sans-serif';
  ctx.fillText('단면', 8, 14);
  if (!profile || profile.cameraAbs === null || profile.subjectTop === null || profile.elevations.some((item) => item === null)) {
    ctx.fillText('지면 높이 없음', 48, 14);
    return;
  }
  const elevations = profile.elevations as number[];
  const lows = elevations.concat([profile.cameraAbs, profile.subjectTop]);
  let min = Math.min(...lows);
  let max = Math.max(...lows);
  if (max - min < 20) {
    min -= 10;
    max += 10;
  }
  const pad = 16;
  const xOf = (distance: number) => pad + (distance / Math.max(profile.groundM, 1)) * (width - pad * 2);
  const yOf = (elevation: number) => height - pad - ((elevation - min) / (max - min)) * (height - pad * 2);
  ctx.beginPath();
  elevations.forEach((elevation, index) => {
    const x = xOf(profile.samples[index].distanceM);
    const y = yOf(elevation);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#8ed4ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineTo(xOf(profile.groundM), height - pad);
  ctx.lineTo(pad, height - pad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(142, 212, 255, 0.16)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(profile.cameraAbs));
  ctx.lineTo(xOf(profile.groundM), yOf(profile.subjectTop));
  ctx.strokeStyle = profile.blocked ? '#ff6b4a' : '#d6f25c';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  dot(ctx, xOf(0), yOf(profile.cameraAbs), '#d6f25c');
  if (!profile.blocked && profile.subjectGround !== null) {
    const feet = yOf(profile.subjectGround);
    const head = yOf(profile.subjectTop);
    ctx.strokeStyle = '#edf2e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xOf(profile.groundM), feet);
    ctx.lineTo(xOf(profile.groundM), head);
    ctx.stroke();
  }
  if (profile.ridge) {
    dot(ctx, xOf(profile.ridge.distanceM), yOf(profile.ridge.elevationM), '#ff6b4a');
    ctx.fillStyle = '#ffb199';
    ctx.fillText('능선', xOf(profile.ridge.distanceM) - 12, yOf(profile.ridge.elevationM) - 6);
  }
  ctx.fillStyle = '#9eb5bd';
  ctx.fillText(`${Math.round(max)}m`, 8, pad + 10);
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerAlt: number,
  pxPerDeg: number,
  columns: SkylineColumn[],
  occluder: boolean,
): void {
  const yOf = (altitude: number) => height / 2 - (altitude - centerAlt) * pxPerDeg;
  const xOf = (offset: number) => width / 2 + offset * pxPerDeg;
  if (!occluder) {
    fillHorizon(ctx, height, columns, (column) => column.altitude, xOf, yOf, 'rgba(28, 52, 34, 0.94)');
    strokeHorizon(ctx, columns, (column) => column.altitude, xOf, yOf, '#f3f6ea', 1.6);
    strokeHorizon(ctx, columns, (column) => column.groundAlt, xOf, yOf, '#d6f25c', 1.2);
    return;
  }
  fillHorizon(ctx, height, columns, (column) => column.occludeAlt, xOf, yOf, 'rgba(16, 28, 20, 0.96)');
  strokeHorizon(ctx, columns, (column) => column.occludeAlt, xOf, yOf, '#ffb199', 1.4);
}

function fillHorizon(
  ctx: CanvasRenderingContext2D,
  height: number,
  columns: SkylineColumn[],
  pick: (column: SkylineColumn) => number | null,
  xOf: (offset: number) => number,
  yOf: (altitude: number) => number,
  color: string,
): void {
  let run: SkylineColumn[] = [];
  const flush = () => {
    const known = run.filter((column) => pick(column) !== null);
    if (known.length < 2) {
      run = [];
      return;
    }
    ctx.beginPath();
    known.forEach((column, index) => {
      const x = xOf(column.offsetDeg);
      const y = yOf(pick(column) as number);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xOf(known[known.length - 1].offsetDeg), height);
    ctx.lineTo(xOf(known[0].offsetDeg), height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    run = [];
  };
  for (const column of columns) {
    if (pick(column) === null) flush();
    else run.push(column);
  }
  flush();
}

function strokeHorizon(
  ctx: CanvasRenderingContext2D,
  columns: SkylineColumn[],
  pick: (column: SkylineColumn) => number | null,
  xOf: (offset: number) => number,
  yOf: (altitude: number) => number,
  color: string,
  width: number,
): void {
  let drawing = false;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const column of columns) {
    const altitude = pick(column);
    if (altitude === null) {
      drawing = false;
      continue;
    }
    const x = xOf(column.offsetDeg);
    const y = yOf(altitude);
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawFocalFrames(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hFov: number,
  vFov: number,
  focals: number[],
): void {
  if (!(hFov > 0) || !(vFov > 0)) return;
  const list = [...focals].sort((a, b) => fieldOfView(b, SENSOR_WIDTH_MM) - fieldOfView(a, SENSOR_WIDTH_MM));
  ctx.save();
  ctx.font = '11px "Noto Sans KR", sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(244, 247, 239, 0.92)';
  ctx.fillStyle = '#f4f7ef';
  for (const mm of list) {
    const frameW = (fieldOfView(mm, SENSOR_WIDTH_MM) / hFov) * width;
    const frameH = (fieldOfView(mm, SENSOR_HEIGHT_MM) / vFov) * height;
    const x = (width - frameW) / 2;
    const y = (height - frameH) / 2;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, frameW - 1), Math.max(1, frameH - 1));
    const text = `${mm}`;
    if (frameW > 48 && frameH > 18) {
      ctx.textAlign = 'left';
      haloText(ctx, text, x + 6, y + 14);
    } else {
      ctx.textAlign = 'left';
      haloText(ctx, text, x + frameW + 4, y + frameH / 2 + 4);
    }
  }
  ctx.restore();
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8, 16, 24, 0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#f4f7ef';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSubject(ctx: CanvasRenderingContext2D, cx: number, cy: number, pxPerDeg: number, subject: FrameSubject): void {
  ctx.save();
  ctx.strokeStyle = subject.hidden ? 'rgba(255, 177, 153, 0.95)' : '#14200a';
  ctx.fillStyle = subject.hidden ? 'rgba(255, 177, 153, 0.85)' : '#d6f25c';
  ctx.lineWidth = 1;
  ctx.setLineDash(subject.hidden ? [2, 2] : []);
  if (subject.kind === 'object') {
    const w = subject.widthDeg * pxPerDeg;
    const h = subject.heightDeg * pxPerDeg;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    return;
  }
  const shape = subject.shape;
  if (!shape) {
    ctx.restore();
    return;
  }
  const h = subject.heightDeg * pxPerDeg;
  const feet = cy + h / 2;
  const yAt = (fromFeet: number) => feet - (fromFeet / shape.heightM) * h;
  const half = (meters: number) => (angularDiameterDegrees(meters, subject.distanceM) * pxPerDeg) / 2;
  const hipY = yAt(shape.hipFromFeetM);
  const shoulderY = yAt(shape.shoulderFromFeetM);
  const crown = yAt(shape.heightM);
  const chin = yAt(shape.heightM - shape.headM);
  ctx.beginPath();
  ctx.moveTo(cx - half(shape.hipM) * 0.35, feet);
  ctx.lineTo(cx - half(shape.hipM) * 0.2, hipY);
  ctx.lineTo(cx + half(shape.hipM) * 0.2, hipY);
  ctx.lineTo(cx + half(shape.hipM) * 0.35, feet);
  ctx.moveTo(cx - half(shape.hipM) * 0.85, feet);
  ctx.lineTo(cx - half(shape.hipM) * 0.55, hipY);
  ctx.lineTo(cx - half(shape.hipM) * 0.2, hipY);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - half(shape.hipM), hipY);
  ctx.lineTo(cx - half(shape.shoulderM), shoulderY);
  ctx.lineTo(cx + half(shape.shoulderM), shoulderY);
  ctx.lineTo(cx + half(shape.hipM), hipY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, (crown + chin) / 2, Math.max(half(shape.headWidthM), 0.4), Math.max((chin - crown) / 2, 0.4), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGalaxy(
  ctx: CanvasRenderingContext2D,
  samples: GalaxySample[],
  bearing: number,
  centerAlt: number,
  pxPerDeg: number,
  width: number,
  height: number,
  bandDeg: number,
  strip = false,
): void {
  const equator = samples.filter((sample) => sample.lat === 0);
  let segment: GalaxySample[] = [];
  const flush = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    ctx.beginPath();
    segment.forEach((sample, index) => {
      const x = width / 2 + wrap(sample.azimuth - bearing) * (strip ? pxPerDeg : pxPerDeg);
      const y = strip ? height * 0.62 - sample.altitude * 0.45 : height / 2 - (sample.altitude - centerAlt) * pxPerDeg;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(214, 220, 255, 0.28)';
    ctx.lineWidth = Math.max(strip ? 8 : bandDeg * pxPerDeg, 2);
    ctx.lineCap = 'round';
    ctx.stroke();
    segment = [];
  };
  for (const sample of equator) {
    const prev = segment[segment.length - 1];
    if (prev && Math.abs(wrap(sample.azimuth - prev.azimuth)) > 40) flush();
    segment.push(sample);
  }
  flush();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: SkyIcon,
  bearing: number,
  centerAlt: number,
  pxPerDeg: number,
  width: number,
  height: number,
  lens: boolean,
): void {
  const offset = wrap(icon.azimuth - bearing);
  const x = width / 2 + offset * pxPerDeg;
  const y = height / 2 - (icon.altitude - centerAlt) * pxPerDeg;
  if (lens && (x < -20 || x > width + 20 || y < -20 || y > height + 20)) return;
  if (icon.kind === 'star') {
    spark(ctx, x, y, starPx(icon.mag ?? 1));
    label(ctx, icon.name, x, y - 7);
    return;
  }
  if (icon.kind === 'galaxy') {
    ctx.strokeStyle = '#d6dcff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0.4, 5.4);
    ctx.stroke();
    label(ctx, icon.name, x, y - 8);
    return;
  }
  const realPx = icon.diameterDeg * pxPerDeg;
  const planet = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus'].includes(icon.kind);
  if (planet && realPx >= 6) {
    ctx.beginPath();
    ctx.fillStyle = planetColor(icon.kind);
    ctx.arc(x, y, realPx / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  drawGlyph(ctx, icon, x, y, planet ? 8 : 7, planet);
  if (planet) label(ctx, icon.sizeLabel, x, y + 12);
}

function drawDisc(
  ctx: CanvasRenderingContext2D,
  icon: SkyIcon,
  bearing: number,
  centerAlt: number,
  pxPerDeg: number,
  width: number,
  height: number,
): void {
  const x = width / 2 + wrap(icon.azimuth - bearing) * pxPerDeg;
  const y = height / 2 - (icon.altitude - centerAlt) * pxPerDeg;
  const radius = (icon.diameterDeg * pxPerDeg) / 2;
  if (radius <= 0) return;
  if (x + radius < 0 || x - radius > width || y + radius < 0 || y - radius > height) return;
  if (icon.kind === 'moon') {
    paintMoon(ctx, x, y, radius, icon.moonShapeDeg ?? 180, icon.limbRad ?? 0);
    if (radius >= 8) label(ctx, `${icon.moonStage}`, x, y - radius - 3);
    return;
  }
  ctx.beginPath();
  ctx.fillStyle = '#ffe28a';
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlyph(ctx: CanvasRenderingContext2D, icon: SkyIcon, x: number, y: number, radius: number, showName: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = glyphColor(icon.kind);
  ctx.strokeStyle = glyphColor(icon.kind);
  ctx.lineWidth = 1.4;
  if (icon.kind === 'sun') {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon.kind === 'moon') {
    paintMoon(ctx, 0, 0, radius, icon.moonShapeDeg ?? 180, icon.limbRad ?? 0);
  } else if (icon.kind === 'meteor') {
    ctx.beginPath();
    ctx.moveTo(-radius, radius * 0.4);
    ctx.lineTo(radius, -radius);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radius, -radius, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (icon.kind === 'sunrise' || icon.kind === 'sunset') {
    ctx.beginPath();
    ctx.arc(0, 1, radius * 0.7, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius, 1);
    ctx.lineTo(radius, 1);
    ctx.stroke();
  } else if (icon.kind === 'moonrise' || icon.kind === 'moonset') {
    paintMoon(ctx, 0, -1, radius * 0.7, 36, Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-radius, radius * 0.6);
    ctx.lineTo(radius, radius * 0.6);
    ctx.stroke();
  } else if (icon.kind === 'star') {
    spark(ctx, 0, 0, radius);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
    if (icon.kind === 'saturn') {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.35, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (showName || icon.active) label(ctx, shortName(icon), x, y - radius - 2);
}

function paintMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, shapeDeg: number, limbRad: number): void {
  const size = Math.max(2, Math.ceil(radius * 2));
  const pixels = Math.min(size, 96);
  const scale = (radius * 2) / pixels;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = '#1c2438';
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  for (let row = 0; row < pixels; row += 1) {
    for (let col = 0; col < pixels; col += 1) {
      const x = (col + 0.5 - pixels / 2) * scale;
      const y = (pixels / 2 - (row + 0.5)) * scale;
      if (!moonLit(x, y, radius, shapeDeg, limbRad)) continue;
      ctx.fillStyle = '#f4f0e4';
      ctx.fillRect(cx + x - scale / 2, cy - y - scale / 2, scale + 0.2, scale + 0.2);
    }
  }
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(244, 240, 228, 0.9)';
  ctx.lineWidth = 1;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBrackets(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = 'rgba(214, 242, 92, 0.9)';
  ctx.lineWidth = 2;
  const n = 12;
  const corners = [
    [0, 0, 1, 1],
    [width, 0, -1, 1],
    [0, height, 1, -1],
    [width, height, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * n, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * n);
    ctx.stroke();
  }
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#f7f3ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = '10px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#edf2e6';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function skyFill(sunAlt: number): string {
  if (sunAlt > 6) return '#8ebfe0';
  if (sunAlt > 0) return '#e7a36a';
  if (sunAlt > -6) return '#31466e';
  if (sunAlt > -12) return '#1b2744';
  return '#0d1424';
}

function planetColor(kind: string): string {
  if (kind === 'mars') return '#ff6b4a';
  if (kind === 'jupiter') return '#f0d2a0';
  if (kind === 'saturn') return '#e6d3a1';
  if (kind === 'venus') return '#fff4d2';
  if (kind === 'uranus') return '#b7fff2';
  return '#d5d8df';
}

function glyphColor(kind: string): string {
  if (kind === 'sun' || kind === 'sunrise' || kind === 'sunset' || kind === 'golden') return '#ffe28a';
  if (kind === 'blue' || kind === 'civil') return '#8ed4ff';
  if (kind === 'nautical' || kind === 'astronomical') return '#9eb0d6';
  if (kind === 'meteor') return '#ffb199';
  return planetColor(kind);
}

function shortName(icon: SkyIcon): string {
  if (icon.kind === 'golden') return '황금';
  if (icon.kind === 'blue') return '블루';
  if (icon.kind === 'civil') return '시민';
  if (icon.kind === 'nautical') return '항해';
  if (icon.kind === 'astronomical') return '천문';
  return icon.name;
}

function starPx(mag: number): number {
  return Math.max(2.2, 5.2 - mag * 1.1);
}

function wrap(degrees: number): number {
  return (((degrees % 360) + 540) % 360) - 180;
}
