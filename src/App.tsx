import { useEffect, useMemo, useRef, useState } from 'react';
import { FrameSketch } from './FrameSketch';
import { buildSpotGuide, formatPosition, positionOn, type ShootIdea, type SpotGuide } from './ideas';
import { bearingDegrees, formatDistance } from './geo';
import { KIND_LABEL, loadNearby, type NearbyPlace } from './nearby';
import { askPermission, notifyOnce, readPermission, type NotifyPermission } from './notify';
import { COMPOSITION_LABEL, type WindowKind } from './places';
import { searchPlaces, type SearchHit } from './search';
import { getDaySky, moonPhaseName, skyPosition, type DaySky, type SkyPoint } from './sky';
import { loadSaved, writeSaved, type SavedShot } from './storage';
import { ALERT_LEAD_MS, dayLabel, formatClock, formatDay, formatRange, formatWhen, seoulDayStart } from './time';
import { shotWindow, type TimeWindow } from './windows';
import { SpotMap } from './SpotMap';

type Fix =
  | { status: 'asking' }
  | { status: 'blocked'; message: string }
  | { status: 'ready'; lat: number; lng: number; elevationM: number; source: 'gps' | 'search' | 'map'; label: string };

type NearbyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; places: NearbyPlace[] };

interface Upcoming {
  saved: SavedShot;
  window: TimeWindow;
  dayOffset: number;
  phase: 'scheduled' | 'approaching' | 'open';
}

const BLOCKED_DENIED = '위치 권한을 거부했습니다. 아래 검색이나 지도의 점으로 자리를 정하세요. 다른 명소로 바꾸지 않습니다.';
const BLOCKED_FAILED = '현재 위치를 가져오지 못했습니다. 아래 검색이나 지도의 점으로 자리를 정하세요. 다른 명소로 바꾸지 않습니다.';

export function App() {
  const [dayOffset, setDayOffset] = useState(0);
  const [fix, setFix] = useState<Fix>({ status: 'asking' });
  const [locateNonce, setLocateNonce] = useState(0);
  const [nearby, setNearby] = useState<NearbyState>({ status: 'idle' });
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<SavedShot[]>(() => loadSaved());
  const [permission, setPermission] = useState<NotifyPermission>(() => readPermission());
  const [now, setNow] = useState(() => new Date());
  const requestGen = useRef(0);

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

  useEffect(() => {
    const gen = ++requestGen.current;
    locate(gen);
    return () => {
      requestGen.current += 1;
    };
  }, [locateNonce]);

  useEffect(() => {
    if (fix.status !== 'ready') {
      setNearby({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => controller.abort(), 40000);
    setNearby({ status: 'loading' });
    loadNearby(fix.lat, fix.lng, controller.signal)
      .then((places) => {
        if (!cancelled) setNearby({ status: 'ready', places });
      })
      .catch(() => {
        if (!cancelled) setNearby({ status: 'error' });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [fix]);

  const ready = fix.status === 'ready' ? fix : null;
  const dayKey = seoulDayStart(0, now).toISOString();
  const sky = useMemo(
    () => (ready ? getDaySky(ready.lat, ready.lng, ready.elevationM, dayOffset, now) : null),
    [ready, dayOffset, dayKey],
  );
  const guide = useMemo(() => {
    if (!ready || !sky) return null;
    return buildSpotGuide({
      name: ready.label,
      kind: 'here',
      lat: ready.lat,
      lng: ready.lng,
      elevationM: ready.elevationM,
      sky,
      phaseName: moonPhaseName(sky.moonPhaseDegrees),
    });
  }, [ready, sky]);
  const live = useMemo(() => {
    if (!ready) return null;
    return {
      sun: skyPosition('sun', now, ready.lat, ready.lng, ready.elevationM),
      moon: skyPosition('moon', now, ready.lat, ready.lng, ready.elevationM),
    };
  }, [ready, now]);
  const nearbyGuides = useMemo(() => {
    if (!ready || nearby.status !== 'ready') return [];
    return nearby.places.map((place) => {
      const placeSky = getDaySky(place.lat, place.lng, place.elevationM, dayOffset, now);
      return {
        place,
        bearing: bearingDegrees(ready.lat, ready.lng, place.lat, place.lng),
        guide: buildSpotGuide({
          name: place.name,
          kind: place.kind,
          lat: place.lat,
          lng: place.lng,
          elevationM: place.elevationM,
          sky: placeSky,
          phaseName: moonPhaseName(placeSky.moonPhaseDegrees),
        }),
      };
    });
  }, [ready, nearby, dayOffset, dayKey]);

  const upcoming = useMemo(
    () => saved.map((item) => upcomingFor(item, now)).filter((item): item is Upcoming => item !== null),
    [saved, now],
  );

  useEffect(() => {
    for (const item of upcoming) {
      if (item.phase !== 'approaching') continue;
      const key = `${item.saved.id}:${item.window.start.toISOString()}`;
      void notifyOnce(
        key,
        '그때 그자리',
        `${item.saved.name} · ${item.saved.title} 창이 30분 안에 시작됩니다. ${formatRange(item.window.start, item.window.end)}`,
      );
    }
  }, [upcoming]);

  function locate(gen: number) {
    if (!navigator.geolocation) {
      setFix({ status: 'blocked', message: BLOCKED_FAILED });
      return;
    }
    setFix({ status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestGen.current !== gen) return;
        setFix({
          status: 'ready',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          elevationM: Number.isFinite(position.coords.altitude) ? position.coords.altitude ?? 0 : 0,
          source: 'gps',
          label: '현재 위치',
        });
      },
      (error) => {
        if (requestGen.current !== gen) return;
        const denied = error.code === error.PERMISSION_DENIED;
        setFix({ status: 'blocked', message: denied ? BLOCKED_DENIED : BLOCKED_FAILED });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function pin(next: Extract<Fix, { status: 'ready' }>) {
    requestGen.current += 1;
    setHits([]);
    setSearchNote(null);
    setFix(next);
  }

  async function runSearch() {
    const text = query.trim();
    if (text.length < 2) {
      setSearchNote('두 글자 이상 입력하세요.');
      setHits([]);
      return;
    }
    setSearching(true);
    setSearchNote(null);
    try {
      const found = await searchPlaces(text, AbortSignal.timeout(12000));
      setHits(found);
      setSearchNote(found.length === 0 ? '검색 결과가 없습니다. 지도에서 점을 찍을 수 있습니다.' : null);
    } catch {
      setHits([]);
      setSearchNote('검색에 실패했습니다. 지도에서 점을 찍을 수 있습니다.');
    } finally {
      setSearching(false);
    }
  }

  function toggleSave(shot: SavedShot) {
    setSaved((current) => {
      const exists = current.some((item) => item.id === shot.id);
      const next = exists ? current.filter((item) => item.id !== shot.id) : [...current, shot];
      writeSaved(next);
      if (!exists) {
        window.setTimeout(() => document.getElementById('saved')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
      return next;
    });
  }

  async function enableAlerts() {
    setPermission(await askPermission());
  }

  const hereLabel = ready ? sourceLabel(ready.source) : '';

  return (
    <main className="app">
      <header className="mast">
        <p className="mark">사진 시각</p>
        <h1>그때 그자리</h1>
        <p className="lede">지금 이 좌표에서 되는 빛과 구도.</p>
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

      <section className="where-block" aria-live="polite">
        {fix.status === 'asking' && <p className="banner">현재 위치를 요청하고 있습니다.</p>}
        {fix.status === 'blocked' && <p className="banner">{fix.message}</p>}
        {ready && (
          <div className="where">
            <p className="where-kicker">{hereLabel}</p>
            <h2>{ready.label}</h2>
            <p>{formatCoord(ready.lat, ready.lng)}</p>
            <button type="button" className="text-btn" onClick={() => setLocateNonce((value) => value + 1)}>
              위치 다시 묻기
            </button>
          </div>
        )}
      </section>

      {ready && sky && guide && live && (
        <SkyBlock
          sky={sky}
          guide={guide}
          live={live}
          dayOffset={dayOffset}
          now={now}
          saved={saved}
          onToggle={toggleSave}
          place={{ name: ready.label, lat: ready.lat, lng: ready.lng, elevationM: ready.elevationM }}
        />
      )}

      {ready && (
        <section className="nearby" aria-labelledby="nearby-title">
          <h2 id="nearby-title">5km 안의 촬영 장소</h2>
          <p className="note">지금 좌표에서 가까운 전망, 공원, 호수, 다리, 봉우리만 불러옵니다.</p>
          {nearby.status === 'loading' && <p className="note">주변 장소를 불러오는 중</p>}
          {nearby.status === 'error' && (
            <p className="note warn">주변 장소를 불러오지 못했습니다. 이 좌표의 하늘은 위에 그대로 있습니다.</p>
          )}
          {nearby.status === 'ready' && nearby.places.length === 0 && (
            <p className="note">5km 안에 이름 있는 전망, 공원, 호수, 다리, 봉우리가 없습니다. 이 좌표의 하늘은 위에 그대로 있습니다.</p>
          )}
          {nearbyGuides.map(({ place, bearing, guide: placeGuide }) => (
            <article key={place.id} className="nearby-card" data-nearby-name={place.name}>
              <p className="shot-kicker">
                {KIND_LABEL[place.kind]} · {formatDistance(place.distanceM)} · {compassFrom(bearing)}
              </p>
              <h3>{place.name}</h3>
              <p className="summary">{placeGuide.dayLine}</p>
              <p className="summary">{placeGuide.moon.summary}</p>
              <TrackList track={placeGuide.track} />
              <div className="ideas">
                {placeGuide.ideas.map((item) => (
                  <IdeaCard
                    key={item.id}
                    idea={item}
                    sky={getDaySky(place.lat, place.lng, place.elevationM, dayOffset, now)}
                    dayOffset={dayOffset}
                    saved={saved.some((shot) => shot.id === item.id)}
                    onToggle={() =>
                      toggleSave({
                        id: item.id,
                        name: place.name,
                        lat: place.lat,
                        lng: place.lng,
                        elevationM: place.elevationM,
                        title: item.title,
                        window: item.window,
                        savedAt: new Date().toISOString(),
                      })
                    }
                  />
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="pick" aria-labelledby="pick-title">
        <h2 id="pick-title">다른 좌표</h2>
        <p className="note">검색하거나 지도를 눌러 점을 찍습니다. 점을 찍기 전에는 그 자리를 계산하지 않습니다.</p>
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <label className="sr" htmlFor="place-search">
            자리 검색
          </label>
          <input
            id="place-search"
            value={query}
            placeholder="동네, 공원, 주소"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className="ghost slim">
            {searching ? '찾는 중' : '검색'}
          </button>
        </form>
        {searchNote && <p className="note">{searchNote}</p>}
        {hits.length > 0 && (
          <div className="results">
            {hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() =>
                  pin({
                    status: 'ready',
                    lat: hit.lat,
                    lng: hit.lng,
                    elevationM: 0,
                    source: 'search',
                    label: shortLabel(hit.label),
                  })
                }
              >
                {hit.label}
              </button>
            ))}
          </div>
        )}
        <SpotMap
          lat={ready?.lat ?? null}
          lng={ready?.lng ?? null}
          onPick={(lat, lng) =>
            pin({
              status: 'ready',
              lat,
              lng,
              elevationM: 0,
              source: 'map',
              label: '지도에서 찍은 점',
            })
          }
        />
        <p className="note">지도의 가운데는 자리가 아닙니다. 점을 찍어야 하늘 정보를 계산합니다.</p>
      </section>

      <section className="saved" id="saved" aria-labelledby="saved-title">
        <h2 id="saved-title">저장한 촬영</h2>
        <AlertStatus permission={permission} onEnable={() => void enableAlerts()} />
        {upcoming.length === 0 ? (
          <p className="note">저장하면 창이 시작되기 30분 전에 알려 줍니다. 알림을 거부해도 다음 창은 여기에 남습니다.</p>
        ) : (
          upcoming.map((item) => (
            <article key={`${item.saved.id}:${item.dayOffset}`} className={`alert-card ${item.phase}`}>
              <p className="alert-kicker">{phaseLabel(item.phase, permission)}</p>
              <h3>{item.saved.name}</h3>
              <p className="alert-title">{item.saved.title}</p>
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
        <p>해와 달의 위치는 Astronomy Engine으로 계산합니다. 주변 장소는 OpenStreetMap입니다.</p>
      </footer>
    </main>
  );
}

function SkyBlock({
  sky,
  guide,
  live,
  dayOffset,
  now,
  saved,
  onToggle,
  place,
}: {
  sky: DaySky;
  guide: SpotGuide;
  live: { sun: SkyPoint; moon: SkyPoint };
  dayOffset: number;
  now: Date;
  saved: SavedShot[];
  onToggle: (shot: SavedShot) => void;
  place: { name: string; lat: number; lng: number; elevationM: number };
}) {
  return (
    <>
      <section className="panel" id="sky" data-spot="here" aria-labelledby="sky-title">
        <div className="panel-head">
          <h2 id="sky-title">이 자리의 하늘</h2>
          <p>{dayLabel(dayOffset)} {formatDay(dayOffset, now)}</p>
        </div>
        <div className="events">
          <EventStat label="일출" time={sky.sunrise} point={positionOn('sun', sky.sunrise, place.lat, place.lng, place.elevationM)} />
          <EventStat label="일몰" time={sky.sunset} point={positionOn('sun', sky.sunset, place.lat, place.lng, place.elevationM)} />
        </div>
        <HourBlock
          label="골든아워"
          morningLabel="아침"
          eveningLabel="저녁"
          morning={rangeOrEmpty(sky.sunrise, sky.goldenMorningEnd)}
          evening={rangeOrEmpty(sky.goldenEveningStart, sky.sunset)}
          morningPoint={positionOn('sun', sky.goldenMorningEnd, place.lat, place.lng, place.elevationM)}
          eveningPoint={positionOn('sun', sky.goldenEveningStart, place.lat, place.lng, place.elevationM)}
        />
        <HourBlock
          label="블루아워"
          morningLabel="아침"
          eveningLabel="저녁"
          morning={rangeOrEmpty(sky.blueMorningStart, sky.sunrise)}
          evening={rangeOrEmpty(sky.sunset, sky.blueEveningEnd)}
          morningPoint={positionOn('sun', sky.blueMorningStart, place.lat, place.lng, place.elevationM)}
          eveningPoint={positionOn('sun', sky.blueEveningEnd, place.lat, place.lng, place.elevationM)}
        />
        <div className="events moon">
          <EventStat label="월출" time={sky.moonrise} point={positionOn('moon', sky.moonrise, place.lat, place.lng, place.elevationM)} />
          <EventStat label="월몰" time={sky.moonset} point={positionOn('moon', sky.moonset, place.lat, place.lng, place.elevationM)} />
        </div>
        <p className="phase">
          달의 위상 <strong>{guide.moon.phaseName}</strong>
          <span>· 밝기 {Math.round(guide.moon.litFraction * 100)}%</span>
        </p>
        <p className="live">{guide.moon.summary}</p>
        <p className="live">
          지금 해 {formatPosition(live.sun)}
          <br />
          지금 달 {formatPosition(live.moon)}
        </p>
      </section>

      <section className="panel track-panel" aria-labelledby="track-title">
        <h2 id="track-title">하루의 해</h2>
        <p className="day-line">{guide.dayLine}</p>
        <TrackList track={guide.track} />
      </section>

      <section className="shots" aria-labelledby="shot-title">
        <h2 id="shot-title">이 자리에서 되는 사진</h2>
        <p className="note">해와 달의 방향에 맞춘 구도입니다. 미리 정해 둔 명소가 아닙니다.</p>
        {guide.ideas.map((item) => (
          <IdeaCard
            key={item.id}
            idea={item}
            sky={sky}
            dayOffset={dayOffset}
            saved={saved.some((shot) => shot.id === item.id)}
            onToggle={() =>
              onToggle({
                id: item.id,
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                elevationM: place.elevationM,
                title: item.title,
                window: item.window,
                savedAt: new Date().toISOString(),
              })
            }
          />
        ))}
      </section>
    </>
  );
}

function EventStat({ label, time, point }: { label: string; time: Date | null; point: SkyPoint | null }) {
  return (
    <div className="event">
      <span>{label}</span>
      <strong>{time ? formatClock(time) : '없음'}</strong>
      <p>{formatPosition(point)}</p>
    </div>
  );
}

function HourBlock({
  label,
  morningLabel,
  eveningLabel,
  morning,
  evening,
  morningPoint,
  eveningPoint,
}: {
  label: string;
  morningLabel: string;
  eveningLabel: string;
  morning: string;
  evening: string;
  morningPoint: SkyPoint | null;
  eveningPoint: SkyPoint | null;
}) {
  return (
    <div className="hours-block">
      <h3>{label}</h3>
      <p>
        {morningLabel} {morning}
      </p>
      <p className="dim">{formatPosition(morningPoint)}</p>
      <p>
        {eveningLabel} {evening}
      </p>
      <p className="dim">{formatPosition(eveningPoint)}</p>
    </div>
  );
}

function TrackList({ track }: { track: SpotGuide['track'] }) {
  return (
    <ol className="track">
      {track.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <p>
            {formatClock(row.time)} · 방위 {Math.round(((row.azimuth % 360) + 360) % 360)}° · 고도 {row.altitude.toFixed(1)}°
          </p>
          <p className="dim">{row.note}</p>
        </li>
      ))}
    </ol>
  );
}

function IdeaCard({
  idea,
  sky,
  dayOffset,
  saved,
  onToggle,
}: {
  idea: ShootIdea;
  sky: DaySky;
  dayOffset: number;
  saved: boolean;
  onToggle: () => void;
}) {
  const window = shotWindow(idea.window, sky);
  return (
    <article className="shot">
      <FrameSketch compositions={[idea.composition]} />
      <p className="shot-kicker">{dayLabel(dayOffset)} {window ? formatRange(window.start, window.end) : '창 없음'}</p>
      <h3>{idea.title}</h3>
      <p className="summary">{idea.summary}</p>
      <div className="method">
        <h4>해·달 위치</h4>
        <p>{idea.detail}</p>
      </div>
      <div className="method">
        <h4>구도 · {COMPOSITION_LABEL[idea.composition]}</h4>
        <p>{idea.frame}</p>
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
    return <p className="note warn">브라우저 알림은 꺼져 있습니다. 다가오는 창은 이 화면에 그대로 표시됩니다.</p>;
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

function rangeOrEmpty(start: Date | null, end: Date | null): string {
  if (!start || !end || end <= start) return '없음';
  return formatRange(start, end);
}

function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? '북위' : '남위';
  const ew = lng >= 0 ? '동경' : '서경';
  return `${ns} ${Math.abs(lat).toFixed(4)} · ${ew} ${Math.abs(lng).toFixed(4)}`;
}

function sourceLabel(source: 'gps' | 'search' | 'map'): string {
  if (source === 'gps') return '지금 있는 좌표';
  if (source === 'search') return '검색으로 고른 좌표';
  return '지도에서 찍은 좌표';
}

function shortLabel(label: string): string {
  const head = label.split(',')[0]?.trim() ?? label;
  return head.length > 28 ? `${head.slice(0, 28)}…` : head;
}

function compassFrom(azimuth: number): string {
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return names[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

function upcomingFor(savedShot: SavedShot, now: Date): Upcoming | null {
  for (const dayOffset of [0, 1]) {
    const sky = getDaySky(savedShot.lat, savedShot.lng, savedShot.elevationM, dayOffset, now);
    const window = shotWindow(savedShot.window as WindowKind, sky);
    if (!window || window.end.getTime() <= now.getTime()) continue;
    return { saved: savedShot, window, dayOffset, phase: phaseOf(window, now) };
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
    return `이 창은 ${formatWhen(item.window.end.getTime() - now.getTime())} 끝납니다.`;
  }
  if (item.phase === 'approaching') {
    return `${formatWhen(item.window.start.getTime() - now.getTime())} 시작. ${permission === 'denied' ? '알림 권한이 없어도 이 창을 보여 줍니다.' : `알림 시각 ${formatClock(alertAt)}.`}`;
  }
  return `시작 ${formatWhen(item.window.start.getTime() - now.getTime())}. 알림 시각 ${formatClock(alertAt)}.`;
}
