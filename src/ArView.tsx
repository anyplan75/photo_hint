import { useEffect, useMemo, useRef, useState } from 'react';
import { drawArSky } from './sight-draw';
import { CAMERA_SENSORS, fieldOfView, viewFocalMm, type SightOptics } from './sightline';
import { skyBodies, skyMarks } from './sky-scene';
import { clockFromMinutes, dateFromSeoul, daysInMonth, formatSeoulClock, seoulDateString, seoulMinutes, seoulParts } from './time';

/** 카메라 위에 하늘을 겹칩니다. 권한이 없어도 지도가 보는 방향으로 그립니다. */
export function ArView({
  place,
  namedPlace,
  optics,
}: {
  place: { lat: number; lng: number };
  namedPlace: boolean;
  optics: SightOptics | null;
}) {
  const sensor = optics?.sensor ?? CAMERA_SENSORS[0];
  const frames = optics?.frames ?? [24, 50, 200];
  const viewMm = viewFocalMm(frames);
  const hFov = fieldOfView(viewMm, sensor.widthMm);
  const vFov = fieldOfView(viewMm, sensor.heightMm);
  const [dateStr, setDateStr] = useState(() => seoulDateString(new Date()));
  const [minutes, setMinutes] = useState(() => seoulMinutes(new Date()));
  const [headingOffset, setHeadingOffset] = useState(0);
  const [pitchOffset, setPitchOffset] = useState(0);
  const [panned, setPanned] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [oriented, setOriented] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [devicePitch, setDevicePitch] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ x: number; y: number; heading: number; pitch: number } | null>(null);

  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : seoulDateString(new Date());
  const when = useMemo(() => dateFromSeoul(safeDate, minutes), [safeDate, minutes]);
  const dayStamp = useMemo(() => dateFromSeoul(safeDate, 12 * 60), [safeDate]);
  const elevation = optics?.elevationM ?? 0;
  const marks = useMemo(() => skyMarks(dayStamp, place.lat, place.lng, elevation), [dayStamp, place.lat, place.lng, elevation]);
  const scene = useMemo(() => skyBodies(when, place.lat, place.lng, elevation, marks), [when, place.lat, place.lng, elevation, marks]);
  const liveHeading = deviceHeading ?? optics?.bearing ?? 0;
  const livePitch = devicePitch ?? optics?.sightAlt ?? 0;
  const heading = normalize(liveHeading + headingOffset);
  const pitch = livePitch + pitchOffset;
  const parts = seoulParts(when);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((next) => {
        if (stopped) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        video.srcObject = next;
        void video.play().catch(() => undefined);
        setCameraOn(true);
      })
      .catch(() => setCameraOn(false));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      const compass = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const headingNow = typeof compass.webkitCompassHeading === 'number' ? compass.webkitCompassHeading : event.alpha === null ? null : (360 - event.alpha) % 360;
      if (headingNow === null || event.beta === null) return;
      setDeviceHeading(headingNow);
      setDevicePitch(event.beta - 90);
      setOriented(true);
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, []);

  useEffect(() => {
    const box = stageRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = box.clientWidth;
      const cssHeight = box.clientHeight;
      canvas.width = Math.max(1, Math.round(cssWidth * ratio));
      canvas.height = Math.max(1, Math.round(cssHeight * ratio));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawArSky(ctx, cssWidth, cssHeight, {
        scene,
        heading,
        pitch,
        hFov,
        vFov,
        sensorWidthMm: sensor.widthMm,
        sensorHeightMm: sensor.heightMm,
        aimBearing: optics?.bearing ?? null,
        aimAlt: optics?.sightAlt ?? 0,
        skyline: optics?.skyline ?? null,
        showVideo: cameraOn,
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [scene, heading, pitch, hFov, vFov, sensor, optics, cameraOn]);

  function applyDay(day: number) {
    const [year, month] = safeDate.split('-').map(Number);
    const last = daysInMonth(year, month);
    const next = Math.min(last, Math.max(1, Math.round(day)));
    setDateStr(`${year}-${String(month).padStart(2, '0')}-${String(next).padStart(2, '0')}`);
  }

  function backToNow() {
    const now = new Date();
    setDateStr(seoulDateString(now));
    setMinutes(seoulMinutes(now));
    setHeadingOffset(0);
    setPitchOffset(0);
    setPanned(false);
  }

  async function allowOrientation() {
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (!ask) return;
    try {
      await ask();
    } catch {
      setOriented(false);
    }
  }

  const permission = !cameraOn && !oriented
    ? '카메라와 기기 방향을 받지 못했습니다. 작가에서 대상을 보는 방향으로 어두운 하늘에 그립니다.'
    : !cameraOn
      ? '카메라를 받지 못했습니다. 어두운 하늘에 같은 방향으로 그립니다.'
      : !oriented
        ? '기기 방향을 받지 못했습니다. 작가에서 대상을 보는 방향으로 맞춥니다.'
        : '';
  const placeNote = namedPlace ? '' : '작가를 아직 찍지 않아 지도 가운데를 기준으로 둡니다.';
  const note = [permission, placeNote].filter(Boolean).join(' ');

  return (
    <section
      className="ar-view"
      data-ar
      data-ar-date={safeDate}
      data-ar-minutes={minutes}
      data-ar-clock={formatSeoulClock(when)}
      data-ar-heading={heading.toFixed(1)}
      data-ar-pitch={pitch.toFixed(1)}
      data-ar-panned={panned ? 'yes' : 'no'}
      data-ar-sun-az={scene.sun.azimuth.toFixed(2)}
      data-ar-moon-az={scene.moon.azimuth.toFixed(2)}
      data-ar-sun-alt={scene.sun.altitude.toFixed(2)}
      data-ar-moon-alt={scene.moon.altitude.toFixed(2)}
      data-ar-lens={viewMm}
      aria-label="AR"
    >
      <div
        className="ar-stage"
        ref={stageRef}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, heading: headingOffset, pitch: pitchOffset };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          const box = stageRef.current;
          if (!start || !box) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) < 3) return;
          setHeadingOffset(start.heading - (dx / Math.max(1, box.clientWidth)) * hFov);
          setPitchOffset(start.pitch + (dy / Math.max(1, box.clientHeight)) * vFov);
          setPanned(true);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <video ref={videoRef} muted playsInline autoPlay />
        <canvas ref={canvasRef} data-ar-sky />
      </div>
      {note ? (
        <p className="ar-note" data-ar-note>
          {note}
        </p>
      ) : null}
      <div className="ar-controls">
        <label>
          날짜
          <input data-ar-date type="date" value={safeDate} onChange={(event) => setDateStr(event.target.value)} />
        </label>
        <label className="sight-scrub">
          {parts.month}월
          <input data-ar-date-scrub type="range" min={1} max={daysInMonth(parts.year, parts.month)} value={parts.day} onChange={(event) => applyDay(Number(event.target.value))} />
          {parts.day}일
        </label>
        <label className="sight-scrub">
          시각
          <input data-ar-time type="range" min={0} max={1439} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          {clockFromMinutes(minutes)}
        </label>
        <button type="button" className="field-btn sea" data-ar-now onClick={backToNow}>
          현재
        </button>
        <button type="button" className="field-btn" onClick={() => void allowOrientation()}>
          방향 허용
        </button>
        <span className="ar-aim">방향 {heading.toFixed(0)}°</span>
      </div>
    </section>
  );
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
