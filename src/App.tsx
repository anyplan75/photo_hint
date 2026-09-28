import { useEffect, useMemo, useState } from 'react';
import { FrameSketch } from './FrameSketch';
import { lightIdea } from './ideas';
import { askPermission, notifyOnce, readPermission, type NotifyPermission } from './notify';
import {
  COMPOSITION_LABEL,
  PLACES,
  findShot,
  lightBody,
  subjectAzimuth,
  type Place,
  type Shot,
} from './places';
import { getDaySky, moonPhaseName, skyPosition, type DaySky } from './sky';
import { loadSaved, writeSaved, type SavedShot } from './storage';
import { ALERT_LEAD_MS, dayLabel, formatClock, formatDay, formatRange, formatWhen } from './time';
import { sampleTime, shotWindow, type TimeWindow } from './windows';

type Selection = { kind: 'place'; id: string } | { kind: 'here'; lat: number; lng: number };

interface Upcoming {
  place: Place;
  shot: Shot;
  window: TimeWindow;
  dayOffset: number;
  phase: 'scheduled' | 'approaching' | 'open';
}

export function App() {
  const [dayOffset, setDayOffset] = useState(0);
  const [selection, setSelection] = useState<Selection>({ kind: 'place', id: PLACES[0].id });
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedShot[]>(() => loadSaved());
  const [permission, setPermission] = useState<NotifyPermission>(() => readPermission());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    const onVisible = () => {
      setNow(new Date());
      setPermission(readPermission());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const here = selection.kind === 'here' ? selection : null;
  const place = selection.kind === 'place' ? PLACES.find((item) => item.id === selection.id) ?? PLACES[0] : null;
  const lat = place?.lat ?? here?.lat ?? PLACES[0].lat;
  const lng = place?.lng ?? here?.lng ?? PLACES[0].lng;
  const elevation = place?.elevationM ?? 0;
  const sky = useMemo(() => getDaySky(lat, lng, elevation, dayOffset, now), [lat, lng, elevation, dayOffset, now]);
  const live = useMemo(() => {
    return {
      sun: skyPosition('sun', now, lat, lng, elevation),
      moon: skyPosition('moon', now, lat, lng, elevation),
    };
  }, [now, lat, lng, elevation]);

  const upcoming = useMemo(
    () => saved.map((item) => upcomingFor(item.shotId, now)).filter((item): item is Upcoming => item !== null),
    [saved, now],
  );

  useEffect(() => {
    for (const item of upcoming) {
      if (item.phase !== 'approaching') continue;
      const key = `${item.shot.id}:${item.window.start.toISOString()}`;
      void notifyOnce(
        key,
        '그때 그자리',
        `${item.place.name} · ${item.shot.title} 창이 30분 안에 시작됩니다. ${formatRange(item.window.start, item.window.end)}`,
      );
    }
  }, [upcoming]);

  function toggleSave(shotId: string) {
    setSaved((current) => {
      const exists = current.some((item) => item.shotId === shotId);
      const next = exists
        ? current.filter((item) => item.shotId !== shotId)
        : [...current, { shotId, savedAt: new Date().toISOString() }];
      writeSaved(next);
      if (!exists) {
        window.setTimeout(() => document.getElementById('saved')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
      return next;
    });
  }

  async function enableAlerts() {
    const next = await askPermission();
    setPermission(next);
  }

  return (
    <main className="app">
      <header className="mast">
        <p className="mark">사진 시각</p>
        <h1>그때 그자리</h1>
        <p className="lede">이 자리, 이 창에서만 되는 사진.</p>
      </header>

      <div className="day-switch" role="tablist" aria-label="날짜">
        {[0, 1].map((offset) => (
          <button
            key={offset}
            type="button"
            role="tab"
            aria-selected={dayOffset === offset}
            className={dayOffset === offset ? 'on' : ''}
            onClick={() => setDayOffset(offset)}
          >
            {offset === 0 ? '오늘' : '내일'}
          </button>
        ))}
      </div>

      <div className="chips" role="list" aria-label="장소">
        <button
          type="button"
          className={selection.kind === 'here' ? 'chip on' : 'chip'}
          onClick={() => locate()}
        >
          {locating ? '위치 찾는 중' : '현재 위치'}
        </button>
        {PLACES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={place?.id === item.id ? 'chip on' : 'chip'}
            onClick={() => {
              setGeoError(null);
              setSelection({ kind: 'place', id: item.id });
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      {geoError && <p className="note error">{geoError}</p>}

      <section className="panel" aria-labelledby="sky-title">
        <div className="panel-head">
          <h2 id="sky-title">{place ? place.name : '현재 위치'}</h2>
          <p>{place ? `${place.area} · ${place.standLabel}` : '이 좌표의 하늘'}</p>
        </div>
        <p className="when">{dayLabel(dayOffset)} {formatDay(dayOffset, now)}</p>
        <p className="coords">{formatCoord(lat, lng)}</p>
        <div className="pair">
          <TimeStat label="일출" value={sky.sunrise ? formatClock(sky.sunrise) : '없음'} />
          <TimeStat label="일몰" value={sky.sunset ? formatClock(sky.sunset) : '없음'} />
        </div>
        <HourRow
          label="골든아워"
          morning={rangeOrEmpty(sky.sunrise, sky.goldenMorningEnd)}
          evening={rangeOrEmpty(sky.goldenEveningStart, sky.sunset)}
        />
        <HourRow
          label="블루아워"
          morning={rangeOrEmpty(sky.blueMorningStart, sky.sunrise)}
          evening={rangeOrEmpty(sky.sunset, sky.blueEveningEnd)}
        />
        <div className="pair moon">
          <TimeStat label="월출" value={sky.moonrise ? formatClock(sky.moonrise) : '없음'} />
          <TimeStat label="월몰" value={sky.moonset ? formatClock(sky.moonset) : '없음'} />
        </div>
        <p className="phase">
          달의 위상 <strong>{moonPhaseName(sky.moonPhaseDegrees)}</strong>
          <span>· 밝기 {Math.round(sky.moonLitFraction * 100)}%</span>
        </p>
        <p className="live">
          지금 해 방위 {Math.round(live.sun.azimuth)}° · 고도 {live.sun.altitude.toFixed(1)}°
          <br />
          지금 달 방위 {Math.round(live.moon.azimuth)}° · 고도 {live.moon.altitude.toFixed(1)}°
        </p>
      </section>

      <section className="shots" aria-labelledby="shot-title">
        <h2 id="shot-title">이 창에만 되는 촬영</h2>
        {place ? (
          place.shots.map((shot) => (
            <ShotCard
              key={shot.id}
              place={place}
              shot={shot}
              sky={sky}
              dayOffset={dayOffset}
              saved={saved.some((item) => item.shotId === shot.id)}
              onToggle={() => toggleSave(shot.id)}
            />
          ))
        ) : (
          <p className="note">
            현재 위치는 하늘 시각만 계산합니다. 시간 창에 묶인 촬영은 고른 장소에서 볼 수 있습니다.
          </p>
        )}
      </section>

      <section className="saved" id="saved" aria-labelledby="saved-title">
        <h2 id="saved-title">저장한 촬영</h2>
        <AlertStatus permission={permission} onEnable={() => void enableAlerts()} />
        {upcoming.length === 0 ? (
          <p className="note">저장하면 창이 시작되기 30분 전에 알려 줍니다. 알림을 거부해도 다음 창은 여기에 남습니다.</p>
        ) : (
          upcoming.map((item) => (
            <article key={item.shot.id} className={`alert-card ${item.phase}`}>
              <p className="alert-kicker">{phaseLabel(item.phase, permission)}</p>
              <h3>{item.place.name}</h3>
              <p className="alert-title">{item.shot.title}</p>
              <p className="alert-window">
                {dayLabel(item.dayOffset)} {formatRange(item.window.start, item.window.end)}
              </p>
              <p className="alert-meta">{alertDetail(item, permission, now)}</p>
            </article>
          ))
        )}
      </section>

      <footer>
        <p>브라우저 메뉴에서 홈 화면에 추가하면 앱처럼 열립니다.</p>
        <p>해와 달의 위치는 Astronomy Engine으로 계산합니다.</p>
      </footer>
    </main>
  );

  function locate() {
    if (!navigator.geolocation) {
      setGeoError('이 브라우저는 현재 위치를 지원하지 않습니다.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelection({ kind: 'here', lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError('위치를 가져오지 못했습니다. 고른 장소를 그대로 둡니다.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
}

function ShotCard({
  place,
  shot,
  sky,
  dayOffset,
  saved,
  onToggle,
}: {
  place: Place;
  shot: Shot;
  sky: DaySky;
  dayOffset: number;
  saved: boolean;
  onToggle: () => void;
}) {
  const window = shotWindow(shot.window, sky);
  const azimuth = subjectAzimuth(place, shot);
  const idea = window
    ? lightIdea({
        body: lightBody(shot.window),
        ...skyPosition(lightBody(shot.window), sampleTime(shot.window, window), place.lat, place.lng, place.elevationM),
        subjectName: shot.subject.name,
        subjectAzimuth: azimuth,
      })
    : '이 날은 그 창이 열리지 않습니다.';

  return (
    <article className="shot">
      <FrameSketch compositions={shot.compositions} />
      <p className="shot-kicker">{dayLabel(dayOffset)} {window ? formatRange(window.start, window.end) : '창 없음'}</p>
      <h3>{shot.title}</h3>
      <p className="summary">{shot.summary}</p>
      <div className="method">
        <h4>고른 프레임</h4>
        <p>서는 곳. {shot.frame.stand}</p>
        <p>{shot.frame.how}</p>
      </div>
      <div className="method">
        <h4>해·달 위치에서</h4>
        <p>{idea}</p>
      </div>
      <div className="method">
        <h4>구도</h4>
        <ul className="tags">
          {shot.compositions.map((item) => (
            <li key={item}>{COMPOSITION_LABEL[item]}</li>
          ))}
        </ul>
      </div>
      <button type="button" className={saved ? 'save on' : 'save'} aria-pressed={saved} onClick={onToggle}>
        {saved ? '저장됨' : '이 촬영 저장'}
      </button>
    </article>
  );
}

function AlertStatus({ permission, onEnable }: { permission: NotifyPermission; onEnable: () => void }) {
  if (permission === 'granted') {
    return <p className="note">브라우저 알림이 켜져 있습니다. 창 시작 30분 전에 울립니다.</p>;
  }
  if (permission === 'denied') {
    return (
      <p className="note warn">
        브라우저 알림은 꺼져 있습니다. 다가오는 창은 이 화면에 그대로 표시됩니다.
      </p>
    );
  }
  if (permission === 'unsupported') {
    return <p className="note warn">이 브라우저는 알림을 지원하지 않습니다. 다가오는 창은 이 화면에 표시됩니다.</p>;
  }
  return (
    <div className="ask">
      <p className="note">알림은 아직 요청하지 않았습니다. 허용하지 않아도 다음 창은 아래에 나옵니다.</p>
      <button type="button" className="ghost" onClick={onEnable}>
        브라우저 알림 허용
      </button>
    </div>
  );
}

function TimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HourRow({ label, morning, evening }: { label: string; morning: string; evening: string }) {
  return (
    <div className="hours">
      <span>{label}</span>
      <p>아침 {morning}</p>
      <p>저녁 {evening}</p>
    </div>
  );
}

function rangeOrEmpty(start: Date | null, end: Date | null): string {
  if (!start || !end || end <= start) return '없음';
  return formatRange(start, end);
}

function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? '북위' : '남위';
  const ew = lng >= 0 ? '동경' : '서경';
  return `${ns} ${Math.abs(lat).toFixed(4)} · ${ew} ${Math.abs(lng).toFixed(4)}`;
}

function upcomingFor(shotId: string, now: Date): Upcoming | null {
  const found = findShot(shotId);
  if (!found) return null;
  for (const dayOffset of [0, 1]) {
    const sky = getDaySky(found.place.lat, found.place.lng, found.place.elevationM, dayOffset, now);
    const window = shotWindow(found.shot.window, sky);
    if (!window || window.end.getTime() <= now.getTime()) continue;
    const phase = phaseOf(window, now);
    return { place: found.place, shot: found.shot, window, dayOffset, phase };
  }
  return null;
}

function phaseOf(window: TimeWindow, now: Date): Upcoming['phase'] {
  const time = now.getTime();
  if (time >= window.start.getTime()) return 'open';
  if (time >= window.start.getTime() - ALERT_LEAD_MS) return 'approaching';
  return 'scheduled';
}

function phaseLabel(phase: Upcoming['phase'], permission: NotifyPermission): string {
  if (phase === 'open') return '지금 창이 열려 있습니다';
  if (phase === 'approaching') {
    return permission === 'granted' ? '곧 시작 · 알림을 보냈습니다' : '곧 시작 · 화면으로 안내 중';
  }
  if (permission === 'denied' || permission === 'unsupported') return '화면으로 안내';
  return '알림 예정';
}

function alertDetail(item: Upcoming, permission: NotifyPermission, now: Date): string {
  const alertAt = new Date(item.window.start.getTime() - ALERT_LEAD_MS);
  if (item.phase === 'open') {
    const left = item.window.end.getTime() - now.getTime();
    return `이 창은 ${formatWhen(left)} 끝납니다.`;
  }
  if (item.phase === 'approaching') {
    return `${formatWhen(item.window.start.getTime() - now.getTime())} 시작. ${permission === 'denied' ? '알림 권한이 없어도 이 창을 보여 줍니다.' : `알림 시각 ${formatClock(alertAt)}.`}`;
  }
  return `시작 ${formatWhen(item.window.start.getTime() - now.getTime())}. 알림 시각 ${formatClock(alertAt)}.`;
}
