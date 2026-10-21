import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FRAME_FOCALS,
  SENSOR_HEIGHT_MM,
  SENSOR_WIDTH_MM,
  VIEW_FOCAL_MM,
  analyzeProfile,
  angularDiameterDegrees,
  apparentAltitudeDegrees,
  assembleSkyline,
  fieldOfView,
  framePhrase,
  azimuthOffset,
  personShape,
  sightSamples,
  skylineProbes,
  type SightPlace,
  type SkylineColumn,
  type SkylineProbe,
} from './sightline';
import { drawLensFrame, drawProfile, drawSkyStrip, type FrameSubject } from './sight-draw';
import { skyBodies, skyMarks, type SkyScene } from './sky-scene';
import { readTerrain, readTerrainLoose } from './terrain-dem';
import { bearingDegrees, distanceMeters } from './geo';
import { dateFromSeoul, formatSeoulClock, seoulDateString, seoulMinutes } from './time';

export interface SightChoice {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** 작가와 대상의 시선, 렌즈 프레임, 하늘 아이콘입니다. 조작은 지도 밖에 둡니다. */
export function SightlineTool({
  photographer,
  subject,
  placing,
  choices,
  onPhotographer,
  onSubject,
  onPlacing,
  onRidge,
}: {
  photographer: SightPlace | null;
  subject: SightPlace | null;
  placing: 'photographer' | 'subject' | null;
  choices: SightChoice[];
  onPhotographer: (place: SightPlace) => void;
  onSubject: (place: SightPlace) => void;
  onPlacing: (role: 'photographer' | 'subject' | null) => void;
  onRidge: (place: SightPlace | null) => void;
}) {
  const [kind, setKind] = useState<'person' | 'object'>('person');
  const [heightText, setHeightText] = useState('1.7');
  const [widthText, setWidthText] = useState('1');
  const [cameraText, setCameraText] = useState('1.5');
  const [frames, setFrames] = useState<number[]>([24, 50, 200]);
  const [dateStr, setDateStr] = useState(() => seoulDateString(new Date()));
  const [minutes, setMinutes] = useState(() => seoulMinutes(new Date()));
  const [playing, setPlaying] = useState(false);
  const [elevations, setElevations] = useState<Array<number | null> | null>(null);
  const [terrainNote, setTerrainNote] = useState<string | null>(null);
  const [terrainState, setTerrainState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [probes, setProbes] = useState<SkylineProbe[]>([]);
  const [probeElevations, setProbeElevations] = useState<Array<number | null> | null>(null);
  const [skylineNote, setSkylineNote] = useState<string | null>(null);
  const [skylineState, setSkylineState] = useState<'idle' | 'loading' | 'ok' | 'gap' | 'none'>('idle');
  const [metrics, setMetrics] = useState({ subjectPx: 0, moonPx: 0, sunPx: 0, pxPerDeg: 0 });
  const frameBox = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const profileRef = useRef<HTMLCanvasElement>(null);
  const onRidgeRef = useRef(onRidge);
  onRidgeRef.current = onRidge;

  const heightM = positive(heightText, 1.7);
  const widthM = positive(widthText, 1);
  const cameraM = positive(cameraText, 1.5);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : seoulDateString(new Date());
  const when = useMemo(() => dateFromSeoul(safeDate, minutes), [safeDate, minutes]);
  const shape = useMemo(() => personShape(heightM), [heightM]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setMinutes((current) => {
        const next = current + 4;
        if (next < 1440) return next;
        setDateStr((day) => seoulDateString(new Date(dateFromSeoul(day, 0).getTime() + 24 * 60 * 60 * 1000)));
        return next - 1440;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [playing]);

  const profile = useMemo(() => {
    if (!photographer || !subject) return null;
    return analyzeProfile({
      from: photographer,
      to: subject,
      elevations,
      cameraHeightM: cameraM,
      subjectHeightM: heightM,
    });
  }, [photographer, subject, elevations, cameraM, heightM]);

  useEffect(() => {
    if (!photographer || !subject) {
      setElevations(null);
      setTerrainNote(null);
      setTerrainState('idle');
      return;
    }
    const samples = sightSamples(photographer, subject);
    const controller = new AbortController();
    setElevations(null);
    setTerrainState('loading');
    setTerrainNote('지면 높이를 읽는 중');
    void readTerrain(samples, controller.signal).then((read) => {
      if (controller.signal.aborted) return;
      setElevations(read.ok ? read.elevations : null);
      setTerrainNote(read.note);
      setTerrainState(read.ok ? 'ok' : 'fail');
    });
    return () => controller.abort();
  }, [photographer, subject]);

  const hFov = fieldOfView(VIEW_FOCAL_MM, SENSOR_WIDTH_MM);
  const vFov = fieldOfView(VIEW_FOCAL_MM, SENSOR_HEIGHT_MM);
  const probeKey = photographer && subject ? `${photographer.lat.toFixed(5)},${photographer.lng.toFixed(5)},${subject.lat.toFixed(5)},${subject.lng.toFixed(5)}` : '';
  useEffect(() => {
    if (!photographer || !subject) {
      setProbes([]);
      setProbeElevations(null);
      setSkylineNote(null);
      setSkylineState('idle');
      return;
    }
    const bearing = bearingDegrees(photographer.lat, photographer.lng, subject.lat, subject.lng);
    const distance = distanceMeters(photographer.lat, photographer.lng, subject.lat, subject.lng);
    const nextProbes = skylineProbes(photographer, bearing, hFov, distance);
    const controller = new AbortController();
    setProbes(nextProbes);
    setProbeElevations(null);
    setSkylineState('loading');
    setSkylineNote('화면 능선을 읽는 중');
    void readTerrainLoose(nextProbes, controller.signal).then((read) => {
      if (controller.signal.aborted) return;
      setProbeElevations(read.elevations);
      setSkylineNote(read.note);
      const known = read.elevations.some((item) => item !== null);
      const missing = read.elevations.some((item) => item === null);
      setSkylineState(!known ? 'none' : missing ? 'gap' : 'ok');
    });
    return () => controller.abort();
  }, [probeKey, hFov, photographer, subject]);

  const ridgeKey = profile?.ridge ? `${profile.ridge.lat.toFixed(5)},${profile.ridge.lng.toFixed(5)}` : '';
  useEffect(() => {
    const ridge = profile?.ridge;
    onRidgeRef.current(ridge ? { lat: ridge.lat, lng: ridge.lng, name: null } : null);
  }, [ridgeKey, profile]);

  const elevation = profile?.cameraAbs !== null && profile?.cameraAbs !== undefined ? Math.max(0, profile.cameraAbs - cameraM) : 0;
  const dayStamp = useMemo(() => dateFromSeoul(safeDate, 12 * 60), [safeDate]);
  const marks = useMemo(
    () => (photographer ? skyMarks(dayStamp, photographer.lat, photographer.lng, elevation) : []),
    [dayStamp, photographer, elevation],
  );
  const scene = useMemo(
    () => (photographer ? skyBodies(when, photographer.lat, photographer.lng, elevation, marks) : null),
    [when, photographer, elevation, marks],
  );

  const subjectSize = kind === 'person' ? heightM : heightM;
  const subjectWidth = kind === 'person' ? shape.shoulderM : widthM;
  const distanceM = profile?.slantM ?? 0;
  const heightDeg = angularDiameterDegrees(subjectSize, distanceM);
  const widthDeg = angularDiameterDegrees(subjectWidth, distanceM);
  const skyline: SkylineColumn[] = useMemo(() => {
    if (!probeElevations || probes.length === 0 || !profile) return [];
    const looseCamera = probes[0]?.distanceM === 0 ? probeElevations[0] : null;
    const cameraAbs = profile.cameraAbs ?? (looseCamera === null ? null : looseCamera + cameraM);
    return assembleSkyline({
      probes,
      elevations: probeElevations,
      profileSamples: profile.samples,
      profileElevations: profile.cameraAbs === null ? null : profile.elevations,
      cameraAbs,
      subjectDistanceM: profile.groundM,
      subjectHeightDeg: heightDeg,
    });
  }, [probeElevations, probes, profile, cameraM, heightDeg]);
  const centerColumn = skyline.find((column) => Math.abs(column.offsetDeg) < 0.001) ?? null;
  const feetAlt = centerColumn?.groundAlt ?? null;
  const sightAlt =
    profile && profile.cameraAbs !== null && profile.subjectGround !== null
      ? apparentAltitudeDegrees(profile.groundM, profile.subjectGround + heightM / 2, profile.cameraAbs)
      : feetAlt === null
        ? (profile?.aimAlt ?? 0)
        : feetAlt + heightDeg / 2;
  const frameSubject: FrameSubject | null =
    profile && distanceM > 0
      ? {
          kind,
          heightDeg,
          widthDeg,
          distanceM,
          shape: kind === 'person' ? shape : null,
          hidden: profile.blocked === true,
          feetAlt,
        }
      : null;

  useEffect(() => {
    const box = frameBox.current;
    const frame = frameRef.current;
    const strip = stripRef.current;
    const profileCanvas = profileRef.current;
    if (!box || !frame || !strip || !profileCanvas) return;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = box.clientWidth;
      const cssHeight = box.clientHeight;
      if (cssWidth > 20 && cssHeight > 20) {
        paint(frame, cssWidth, cssHeight, ratio, (ctx) => {
          const next = drawLensFrame(ctx, cssWidth, cssHeight, hFov, vFov, sightAlt, profile?.bearing ?? 0, frameSubject, scene, skyline, frames);
          setMetrics((current) =>
            current.subjectPx === next.subjectPx && current.moonPx === next.moonPx && current.pxPerDeg === next.pxPerDeg ? current : next,
          );
        });
      }
      const stripWidth = strip.clientWidth || box.clientWidth;
      if (stripWidth > 20) {
        paint(strip, stripWidth, 64, ratio, (ctx) => drawSkyStrip(ctx, stripWidth, 64, profile?.bearing ?? 0, scene));
        paint(profileCanvas, stripWidth, 96, ratio, (ctx) => drawProfile(ctx, stripWidth, 96, profile));
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [hFov, vFov, profile, frameSubject, scene, sightAlt, skyline, frames]);

  const sunPhrase = scene && profile ? framePhrase(azimuthOffset(profile.bearing, scene.sun.azimuth), scene.sun.altitude, sightAlt, hFov, vFov) : '';
  const moonPhrase = scene && profile ? framePhrase(azimuthOffset(profile.bearing, scene.moon.azimuth), scene.moon.altitude, sightAlt, hFov, vFov) : '';
  const active = scene?.icons.filter((icon) => icon.active && icon.kind !== 'sun' && icon.kind !== 'moon' && icon.kind !== 'star').map((icon) => icon.name) ?? [];
  const activeText = unique(active).slice(0, 4).join(' · ');
  const ratioDeg = heightDeg > 0 && scene ? scene.moon.diameterDeg / heightDeg : 0;
  const ratioPx = metrics.subjectPx > 0 ? metrics.moonPx / metrics.subjectPx : 0;
  const blockText =
    profile?.blocked === true
      ? '능선에 가려 대상이 보이지 않습니다.'
      : profile?.blocked === false
        ? '시선이 열려 있습니다.'
        : terrainState === 'loading'
          ? '지면 높이를 읽는 중'
          : '';

  return (
    <section
      className="sightline"
      data-sightline
      data-subject-kind={kind}
      data-subject-height={heightM}
      data-subject-width={kind === 'object' ? widthM : shape.shoulderM}
      data-camera-height={cameraM}
      data-lens-mm={VIEW_FOCAL_MM}
      data-frames={[...frames].sort((a, b) => a - b).join(',')}
      data-skyline={skylineState}
      data-ground-alt={feetAlt === null ? '' : feetAlt.toFixed(2)}
      data-ridge-alt={centerColumn?.altitude === null || centerColumn?.altitude === undefined ? '' : centerColumn.altitude.toFixed(2)}
      data-sight-alt={profile ? sightAlt.toFixed(2) : ''}
      data-hfov={hFov.toFixed(3)}
      data-vfov={vFov.toFixed(3)}
      data-distance-m={profile ? profile.groundM.toFixed(1) : ''}
      data-slant-m={distanceM ? distanceM.toFixed(1) : ''}
      data-bearing={profile ? profile.bearing.toFixed(1) : ''}
      data-subject-deg={heightDeg ? heightDeg.toFixed(5) : ''}
      data-subject-width-deg={widthDeg ? widthDeg.toFixed(5) : ''}
      data-sun-deg={scene ? scene.sun.diameterDeg.toFixed(4) : ''}
      data-sun-alt={scene ? scene.sun.altitude.toFixed(2) : ''}
      data-sun-az={scene ? scene.sun.azimuth.toFixed(2) : ''}
      data-moon-deg={scene ? scene.moon.diameterDeg.toFixed(4) : ''}
      data-moon-alt={scene ? scene.moon.altitude.toFixed(2) : ''}
      data-moon-az={scene ? scene.moon.azimuth.toFixed(2) : ''}
      data-moon-stage={scene?.moon.moonStage ?? ''}
      data-moon-shape={scene?.moon.moonShapeDeg ?? ''}
      data-blocked={profile?.blocked === null || profile?.blocked === undefined ? 'unknown' : profile.blocked ? 'yes' : 'no'}
      data-terrain={terrainState}
      data-clock={formatSeoulClock(when)}
      data-minutes={minutes}
      data-playing={playing ? 'yes' : 'no'}
      data-subject-px={metrics.subjectPx.toFixed(2)}
      data-moon-px={metrics.moonPx.toFixed(2)}
      data-sun-px={metrics.sunPx.toFixed(2)}
      data-px-per-deg={metrics.pxPerDeg.toFixed(4)}
      data-ratio-deg={ratioDeg ? ratioDeg.toFixed(4) : ''}
      data-ratio-px={ratioPx ? ratioPx.toFixed(4) : ''}
      aria-label="시선"
    >
      <h3>시선</h3>
      <p>작가와 대상, 화면 속 능선, 그날의 하늘을 한 프레임에 둡니다.</p>
      <div className="sight-row">
        <button type="button" className="field-btn" data-place="photographer" aria-pressed={placing === 'photographer'} onClick={() => onPlacing(placing === 'photographer' ? null : 'photographer')}>
          작가 찍기
        </button>
        <button type="button" className="field-btn" data-place="subject" aria-pressed={placing === 'subject'} onClick={() => onPlacing(placing === 'subject' ? null : 'subject')}>
          대상 찍기
        </button>
      </div>
      <div className="sight-row">
        <select aria-label="작가 자리" data-pick="photographer" value="" onChange={(event) => pick(event.target.value, choices, onPhotographer)}>
          <option value="">작가 · 추천·저장</option>
          {choices.map((choice) => (
            <option key={`p-${choice.id}`} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
        <select aria-label="대상 자리" data-pick="subject" value="" onChange={(event) => pick(event.target.value, choices, onSubject)}>
          <option value="">대상 · 추천·저장</option>
          {choices.map((choice) => (
            <option key={`s-${choice.id}`} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
      </div>
      <p className="sight-read" data-points>
        작가 {placeText(photographer)}
        <br />
        대상 {placeText(subject)}
        {placing ? ` · 지도를 눌러 ${placing === 'photographer' ? '작가를' : '대상을'} 놓으세요.` : ''}
      </p>
      <div className="sight-row">
        <button type="button" className="field-btn" data-subject-kind="person" aria-pressed={kind === 'person'} onClick={() => setKind('person')}>
          사람
        </button>
        <button type="button" className="field-btn" data-subject-kind="object" aria-pressed={kind === 'object'} onClick={() => setKind('object')}>
          사물
        </button>
        {kind === 'person' ? (
          <label>
            키
            <input data-subject-height value={heightText} inputMode="decimal" onChange={(event) => setHeightText(event.target.value)} />
            m
          </label>
        ) : (
          <>
            <label>
              가로
              <input data-subject-width value={widthText} inputMode="decimal" onChange={(event) => setWidthText(event.target.value)} />
              m
            </label>
            <label>
              세로
              <input data-subject-height value={heightText} inputMode="decimal" onChange={(event) => setHeightText(event.target.value)} />
              m
            </label>
          </>
        )}
        <label>
          촬영 높이
          <input data-camera-height value={cameraText} inputMode="decimal" onChange={(event) => setCameraText(event.target.value)} />
          m
        </label>
      </div>
      <div className="sight-row sight-focal" role="group" aria-label="화각선">
        {FRAME_FOCALS.map((mm) => (
          <button
            key={mm}
            type="button"
            className="field-btn"
            data-focal={mm}
            aria-pressed={frames.includes(mm)}
            onClick={() =>
              setFrames((current) => (current.includes(mm) ? current.filter((item) => item !== mm) : [...current, mm].sort((a, b) => a - b)))
            }
          >
            {mm}
          </button>
        ))}
      </div>
      <div className="sight-row">
        <label>
          날짜
          <input data-sky-date type="date" value={dateStr} onChange={(event) => setDateStr(event.target.value)} />
        </label>
        <label className="sight-scrub">
          시각
          <input data-time-scrub type="range" min={0} max={1439} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
        </label>
        <button type="button" className="field-btn sea" data-time-play aria-pressed={playing} onClick={() => setPlaying((current) => !current)}>
          {playing ? '멈춤' : '재생'}
        </button>
      </div>
      <p className="sight-read" data-sight-readout>
        {profile ? `거리 ${formatKm(profile.groundM)} · 방위 ${profile.bearing.toFixed(0)}°` : '두 점을 놓으면 거리와 방위를 계산합니다.'}
        {distanceM > 0 ? ` · ${kind === 'person' ? '사람' : '사물'} 각크기 ${heightDeg.toFixed(3)}°` : ''}
        {kind === 'object' && distanceM > 0 ? ` · 가로 ${widthDeg.toFixed(3)}°` : ''}
        <br />
        화면 {VIEW_FOCAL_MM}mm · 가로 {hFov.toFixed(1)}° · 세로 {vFov.toFixed(1)}° · 화각 {[...frames].sort((a, b) => a - b).join(' · ') || '없음'} · {formatSeoulClock(when)} 서울
        {scene ? (
          <>
            <br />
            해 고도 {scene.sun.altitude.toFixed(1)}° 방위 {scene.sun.azimuth.toFixed(0)}° 지름 {scene.sun.sizeLabel}
            {sunPhrase ? ` · ${sunPhrase}` : ''}
            <br />
            달 고도 {scene.moon.altitude.toFixed(1)}° 방위 {scene.moon.azimuth.toFixed(0)}° 지름 {scene.moon.sizeLabel} · 단계 {scene.moon.moonStage} {stageName(scene)}
            {moonPhrase ? ` · ${moonPhrase}` : ''}
          </>
        ) : null}
        {scene && scene.showers.length > 0 ? (
          <>
            <br />
            {scene.showers.join(' · ')}
          </>
        ) : null}
        {activeText ? (
          <>
            <br />
            지금 {activeText}
          </>
        ) : null}
        {blockText ? (
          <>
            <br />
            {blockText}
          </>
        ) : null}
        {terrainNote ? (
          <>
            <br />
            {terrainNote}
          </>
        ) : null}
        {skylineNote && skylineNote !== terrainNote ? (
          <>
            <br />
            {skylineNote}
          </>
        ) : null}
        {ratioDeg > 0 ? (
          <>
            <br />
            달/대상 각크기 {ratioDeg.toFixed(2)}배 · 프레임 {ratioPx ? `${ratioPx.toFixed(2)}배` : '계산 중'}
          </>
        ) : null}
      </p>
      <div className="sight-frame-box" ref={frameBox} style={{ aspectRatio: `${hFov} / ${vFov}` }}>
        <canvas ref={frameRef} data-sight-frame />
      </div>
      <canvas ref={stripRef} className="sight-strip" data-sight-strip />
      <canvas ref={profileRef} className="sight-profile" data-sight-profile />
    </section>
  );
}

function paint(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  ratio: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  canvas.width = Math.max(1, Math.round(cssWidth * ratio));
  canvas.height = Math.max(1, Math.round(cssHeight * ratio));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw(ctx);
}

function pick(id: string, choices: SightChoice[], setPlace: (place: SightPlace) => void): void {
  const found = choices.find((choice) => choice.id === id);
  if (!found) return;
  setPlace({ lat: found.lat, lng: found.lng, name: found.name });
}

function placeText(place: SightPlace | null): string {
  if (!place) return '아직 없음';
  const name = place.name ? `${place.name} · ` : '';
  return `${name}${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
}

function positive(value: string, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 500) return fallback;
  return number;
}

function formatKm(meters: number): string {
  if (meters < 950) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

function stageName(scene: SkyScene): string {
  const names = ['삭', '초승', '초승', '상현 전', '상현', '차는 달', '차는 달', '보름', '기우는 달', '기우는 달', '하현 전', '하현', '그믐', '그믐', '그믐'];
  return names[scene.moon.moonStage ?? 0] ?? '';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
