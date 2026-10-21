import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { describeAdded, KNOWN_REFERENCES, weeklyPick, windowForScene } from './catalog';
import { activeScene, boxAround, rankPlaces, type RankedPlace } from './collect';
import { loadFieldPrefs, writeFieldPrefs, type FieldPrefs } from './field-prefs';
import { AiStatus } from './AiStatus';
import { GuidePanel } from './GuidePanel';
import { PublicNotes } from './PublicNotes';
import { MyPlaces } from './MyPlaces';
import { emptyRoad, type RoadOverlay } from './map-tools';
import { RankList } from './RankList';
import { RoadTools } from './RoadTools';
import { ReferenceBook } from './ReferenceBook';
import {
  inJejuBox,
  isJeju,
  JEJU_SPOTS,
  loadSpotsAround,
  spotsForRegion,
  type SceneChoice,
  type Spot,
} from './region-places';
import { searchPlaces, type SearchHit } from './search';
import { useSession } from './session';
import { SettingsScreen } from './SettingsScreen';
import { ShootMap, type SelectionView } from './ShootMap';
import { SightlineTool, type SightChoice } from './SightlineTool';
import type { SightPlace } from './sightline';
import type { ShootPoint } from './shoot-points';
import { parseReferenceAddress, referenceKey } from './sources';
import {
  loadReferences,
  loadRegion,
  writeReferences,
  writeRegion,
  type StoredReference,
  type StoredRegion,
} from './storage';
import { useSyncedShootPoints } from './use-shoot-points';

type Tab = 'map' | 'book' | 'mine' | 'settings';

const START = { lat: 33.390542, lng: 126.556513 };

export function App() {
  const session = useSession();
  const [now] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('map');
  const savedRegion = useRef(loadRegion());
  const [prefs, setPrefs] = useState<FieldPrefs>(() => loadFieldPrefs());
  const [region, setRegion] = useState<StoredRegion | null>(savedRegion.current);
  const [center, setCenter] = useState(() =>
    savedRegion.current?.lat != null && savedRegion.current.lng != null
      ? { lat: savedRegion.current.lat, lng: savedRegion.current.lng }
      : START,
  );
  const [regionTitle, setRegionTitle] = useState(savedRegion.current?.name || '선택한 지역');
  const [useMyLocation, setUseMyLocation] = useState(() => loadFieldPrefs().useMyLocation && !savedRegion.current);
  const [locationText, setLocationText] = useState('위치를 확인하는 중');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [road, setRoad] = useState<RoadOverlay>(emptyRoad);
  const [photographer, setPhotographer] = useState<SightPlace | null>(null);
  const [subjectPlace, setSubjectPlace] = useState<SightPlace | null>(null);
  const [placing, setPlacing] = useState<'photographer' | 'subject' | null>(null);
  const [ridge, setRidge] = useState<SightPlace | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('지도를 준비하고 있습니다.');
  const [fly, setFly] = useState<{ lat: number; lng: number; token: number } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mapView, setMapView] = useState<SelectionView | null>(null);
  const [selectRequest, setSelectRequest] = useState<{ kind: 'spot'; osm: string } | { kind: 'point'; id: string } | null>(null);
  const [references, setReferences] = useState<StoredReference[]>(() => loadReferences());
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [sceneOverride, setSceneOverride] = useState<SceneChoice | null>(null);
  const generation = useRef(0);
  const radiusRef = useRef(prefs.radiusKm);
  const centerRef = useRef(center);
  radiusRef.current = prefs.radiusKm;
  centerRef.current = center;
  const pick = useMemo(() => weeklyPick(now), [now]);
  const scene = activeScene(sceneOverride ?? pick.scene, prefs.preferScenes);
  const windowKind = scene ? windowForScene(scene, pick.window) : pick.window;
  const regionName =
    !useMyLocation && region?.name
      ? region.name
      : inJejuBox(center.lat, center.lng) || isJeju(regionTitle)
        ? '제주'
        : regionTitle || '내 주변';
  const sync = useSyncedShootPoints(regionName, session.uid, session.ready);

  const ranked = useMemo(
    () =>
      rankPlaces({
        spots,
        points: sync.points,
        scene,
        center,
        radiusKm: prefs.radiusKm,
        windowKind,
        now,
      }),
    [spots, sync.points, scene, center, prefs.radiusKm, windowKind, now],
  );
  const rankedSpots = ranked.flatMap((place) => (place.spot ? [place.spot] : []));
  const sightChoices = useMemo<SightChoice[]>(
    () => [
      ...rankedSpots.map((spot) => ({ id: `spot:${spot.osm}`, name: spot.name, lat: spot.lat, lng: spot.lng })),
      ...sync.points.map((point) => ({ id: `point:${point.id}`, name: point.name, lat: point.lat, lng: point.lng })),
    ],
    [rankedSpots, sync.points],
  );
  const weeklyOsm = ranked.find((place) => place.spot?.matchesScene)?.spot?.osm ?? '';

  const rememberView = useCallback((view: SelectionView | null) => {
    setMapView((current) => (viewKey(current) === viewKey(view) ? current : view));
  }, []);

  const refresh = useCallback(async (lat: number, lng: number, title: string) => {
    const ticket = ++generation.current;
    setBusy(true);
    setStatus('주변 자리와 이번 주 장면을 맞추는 중');
    const catalog = spotsForRegion(title);
    if (catalog || inJejuBox(lat, lng) || isJeju(title)) {
      if (ticket !== generation.current) return;
      setSpots(catalog ?? JEJU_SPOTS);
      setBusy(false);
      return;
    }
    const [south, west, north, east] = boxAround(lat, lng, radiusRef.current);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const found = await loadSpotsAround(south, west, north, east, controller.signal);
      if (ticket !== generation.current) return;
      setSpots(found);
      setBusy(false);
    } catch {
      if (ticket !== generation.current) return;
      setSpots([]);
      setBusy(false);
      setStatus('이 지역의 장소 자료를 가져오지 못했습니다. 인터넷을 확인한 뒤 다시 분석하세요.');
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const saved = savedRegion.current;
    function useSavedRegion(reason: string) {
      if (saved?.lat != null && saved.lng != null) {
        setUseMyLocation(false);
        setLocationText(reason);
        setRegionTitle(saved.name);
        setCenter({ lat: saved.lat, lng: saved.lng });
        void refresh(saved.lat, saved.lng, saved.name);
        return;
      }
      setLocationText('위치를 가져오지 못했습니다. 지역을 검색하세요.');
      setStatus('지역을 검색한 뒤 이 지역 분석을 누르세요.');
    }
    if (!navigator.geolocation) {
      useSavedRegion('이 브라우저에서 내 위치를 쓸 수 없어 저장한 지역을 사용 중');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUseMyLocation(true);
        setLocationText('현재 위치를 사용 중');
        setCenter({ lat, lng });
        setRegionTitle('내 주변');
        setFly({ lat, lng, token: 1 });
        void refresh(lat, lng, '내 주변');
      },
      () => useSavedRegion('위치 권한이 없어 저장한 지역을 사용 중'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  }, [refresh]);

  useEffect(() => {
    if (busy) return;
    if (spots.length === 0 && ranked.length === 0) return;
    if (!scene) {
      setStatus('참고 도감에서 장면을 고르면 점수를 매깁니다.');
      return;
    }
    if (ranked.length === 0) {
      setStatus('이 반경에 공개된 자리가 없습니다. 지도를 누르면 그 좌표를 내 자리로 저장할 수 있습니다.');
      return;
    }
    setStatus(`${ranked.length}곳을 장면 점수로 줄 세웠습니다.`);
  }, [busy, ranked.length, scene, spots.length]);

  async function findPlaces(event?: FormEvent) {
    event?.preventDefault();
    const name = query.trim();
    if (!name) return;
    const controller = new AbortController();
    try {
      const found = await searchPlaces(name, controller.signal);
      setHits(found);
      if (found.length === 0) setStatus('그 지역을 찾지 못했습니다.');
    } catch {
      setStatus('지역을 찾지 못했습니다. 잠시 뒤 다시 시도하세요.');
    }
  }

  function go(hit: SearchHit) {
    const name = shortTitle(hit.label);
    const next: StoredRegion = {
      name,
      label: hit.label,
      lat: hit.lat,
      lng: hit.lng,
      south: hit.south,
      north: hit.north,
      west: hit.west,
      east: hit.east,
      savedAt: new Date().toISOString(),
    };
    setUseMyLocation(false);
    setLocationText('검색한 지역을 사용 중');
    writeFieldPrefs({ ...prefs, useMyLocation: false });
    writeRegion(next);
    setCenter({ lat: hit.lat, lng: hit.lng });
    setRegionTitle(name);
    setRegion(next);
    setHits([]);
    setQuery('');
    setFly({ lat: hit.lat, lng: hit.lng, token: Date.now() });
    void refresh(hit.lat, hit.lng, name);
  }

  function focusOnMe() {
    setUseMyLocation(true);
    writeFieldPrefs({ ...prefs, useMyLocation: true });
    if (!navigator.geolocation) {
      setStatus('이 브라우저에서 내 위치를 쓸 수 없습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocationText('현재 위치를 사용 중');
        setCenter({ lat, lng });
        setRegionTitle('내 주변');
        setFly({ lat, lng, token: Date.now() });
        void refresh(lat, lng, '내 주변');
      },
      () => setStatus('아직 내 위치가 없습니다. 위치 권한을 허용하세요.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function useSaved() {
    if (!region || region.lat == null || region.lng == null) {
      setStatus('저장된 지역이 없습니다. 지도를 맞춘 뒤 이 지역을 저장하세요.');
      return;
    }
    setUseMyLocation(false);
    writeFieldPrefs({ ...prefs, useMyLocation: false });
    setCenter({ lat: region.lat, lng: region.lng });
    setRegionTitle(region.name);
    setFly({ lat: region.lat, lng: region.lng, token: Date.now() });
    void refresh(region.lat, region.lng, region.name);
  }

  function saveCurrentRegion() {
    const next: StoredRegion = {
      name: regionTitle || '저장한 지역',
      label: region?.label ?? '',
      lat: center.lat,
      lng: center.lng,
      south: region?.south ?? null,
      north: region?.north ?? null,
      west: region?.west ?? null,
      east: region?.east ?? null,
      savedAt: new Date().toISOString(),
    };
    writeRegion(next);
    setRegion(next);
    setUseMyLocation(false);
    writeFieldPrefs({ ...prefs, useMyLocation: false });
    setStatus(`${next.name} 지역을 저장했습니다.`);
  }

  function openPlace(place: RankedPlace) {
    setSelectRequest(place.pointId ? { kind: 'point', id: place.pointId } : { kind: 'spot', osm: place.id });
    setGuideOpen(true);
    setTab('map');
  }

  function openPoint(point: ShootPoint) {
    setCenter({ lat: point.lat, lng: point.lng });
    setFly({ lat: point.lat, lng: point.lng, token: Date.now() });
    setSelectRequest({ kind: 'point', id: point.id });
    setGuideOpen(true);
    setTab('map');
  }

  async function saveMineFromGuide() {
    if (!mapView || !selectRequest || selectRequest.kind !== 'spot') return;
    const place = ranked.find((item) => item.id === selectRequest.osm);
    if (!place) return;
    if (sync.points.some((point) => point.name === place.name && Math.abs(point.lat - place.lat) < 0.0008)) {
      setStatus('이미 내 자리로 저장한 좌표입니다.');
      return;
    }
    const point: ShootPoint = {
      id: crypto.randomUUID(),
      region: regionName,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      savedAt: new Date().toISOString(),
      note: place.spot?.address ?? undefined,
    };
    try {
      await sync.addPoint(point);
      setStatus(`${place.name} 자리를 내 자리로 저장했습니다.`);
    } catch {
      setStatus('계정에 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  function addReference(event: FormEvent) {
    event.preventDefault();
    const parsed = parseReferenceAddress(urlDraft);
    if ('error' in parsed) {
      setUrlError(parsed.error);
      return;
    }
    if (references.some((item) => referenceKey(item.url) === referenceKey(parsed.url))) {
      setUrlError('이미 넣어 둔 페이지입니다.');
      return;
    }
    const next = [
      { id: referenceKey(parsed.url), url: parsed.url, source: parsed.source, addedAt: new Date().toISOString() },
      ...references,
    ];
    writeReferences(next);
    setReferences(next);
    setUrlDraft('');
    setUrlError(null);
  }

  function chooseScene(id: string, nextScene: SceneChoice) {
    if (id === pick.id || !references.some((item) => item.id === id)) {
      setSceneOverride(nextScene);
      return;
    }
    const next = references.map((item) => (item.id === id ? { ...item, sceneChoice: nextScene } : item));
    writeReferences(next);
    setReferences(next);
  }

  function removeReference(id: string) {
    const next = references.filter((item) => item.id !== id);
    writeReferences(next);
    setReferences(next);
  }

  function toggleScene(nextScene: SceneChoice) {
    const preferScenes = prefs.preferScenes.includes(nextScene)
      ? prefs.preferScenes.filter((item) => item !== nextScene)
      : [...prefs.preferScenes, nextScene];
    const next = { ...prefs, preferScenes };
    setPrefs(next);
    writeFieldPrefs({ ...next, useMyLocation });
  }

  const weeklyShown = sceneOverride ?? pick.scene;
  const listTitle = useMyLocation ? '내 주변' : regionTitle;

  return (
    <main className="app shell" data-shell={tab}>
      <aside className="sidebar">
        <p className="sidebar-mark">촬영 참고</p>
        <p className="sidebar-name">여기야 여기</p>
        <Nav tab={tab} onTab={setTab} />
      </aside>
      <div className="stage">
        <h1 className="phone-title">여기야 여기</h1>
        {tab === 'map' && (
          <div className="field">
            <div className="field-map">
              <ShootMap
                bare
                region={regionName}
                center={center}
                spots={rankedSpots}
                activeOsm={weeklyOsm}
                onSelect={(osm) => {
                  setSelectRequest({ kind: 'spot', osm });
                  setGuideOpen(true);
                }}
                scene={scene}
                basis={pick.basis}
                windowKind={windowKind}
                now={now}
                sessionReady={session.ready}
                uid={session.uid}
                onView={rememberView}
                onOpenGuide={() => setGuideOpen(true)}
                fly={fly}
                onDrag={(lat, lng) => setCenter({ lat, lng })}
                selectRequest={selectRequest}
                road={road}
                sight={{ photographer, subject: subjectPlace, ridge, placing }}
                onPlaceSight={(lat, lng) => {
                  const place = { lat, lng, name: null };
                  if (placing === 'photographer') setPhotographer(place);
                  if (placing === 'subject') setSubjectPlace(place);
                  setPlacing(null);
                }}
                external={{
                  points: sync.points,
                  mode: sync.mode,
                  error: sync.error,
                  addPoint: sync.addPoint,
                  removePoint: sync.removePoint,
                }}
              />
            </div>
            <div className="field-list">
              <SightlineTool
                photographer={photographer}
                subject={subjectPlace}
                placing={placing}
                choices={sightChoices}
                onPhotographer={(place) => {
                  setPhotographer(place);
                  setPlacing(null);
                }}
                onSubject={(place) => {
                  setSubjectPlace(place);
                  setPlacing(null);
                }}
                onPlacing={setPlacing}
                onRidge={setRidge}
              />
              <RoadTools center={center} onChange={setRoad} />
              <AiStatus places={ranked} usingHere={useMyLocation} />
              <form className="field-controls" onSubmit={findPlaces}>
                <div className="control-search">
                  <label className="sr" htmlFor="region-name">
                    지역 검색
                  </label>
                  <input
                    id="region-name"
                    name="region"
                    value={query}
                    placeholder="지역, 오름, 해안 검색"
                    onChange={(event) => setQuery(event.target.value)}
                    autoComplete="off"
                  />
                  <button className="field-btn sea" type="submit">
                    찾기
                  </button>
                </div>
                {hits.length > 0 && (
                  <div className="control-hits">
                    {hits.map((hit) => (
                      <button key={hit.id} type="button" onClick={() => go(hit)}>
                        {hit.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="control-where">
                  <strong>{listTitle}</strong>
                  <span>{locationText}</span>
                </div>
                <label className="control-radius">
                  <span>반경 {prefs.radiusKm}km</span>
                  <input
                    type="range"
                    min={3}
                    max={30}
                    step={1}
                    value={prefs.radiusKm}
                    aria-label="반경"
                    onChange={(event) => {
                      const radiusKm = Number(event.target.value);
                      const next = { ...prefs, radiusKm };
                      setPrefs(next);
                      writeFieldPrefs({ ...next, useMyLocation });
                    }}
                    onMouseUp={() => void refresh(centerRef.current.lat, centerRef.current.lng, useMyLocation ? '내 주변' : regionTitle)}
                    onTouchEnd={() => void refresh(centerRef.current.lat, centerRef.current.lng, useMyLocation ? '내 주변' : regionTitle)}
                  />
                </label>
                <div className="control-actions">
                  <button className="field-btn" type="button" onClick={focusOnMe}>
                    내 위치
                  </button>
                  <button className="field-btn" type="button" onClick={useSaved}>
                    저장 지역
                  </button>
                  <button className="field-btn" type="button" onClick={saveCurrentRegion}>
                    이 지역 저장
                  </button>
                </div>
                <button
                  className="field-btn good"
                  type="button"
                  disabled={busy}
                  onClick={() => void refresh(center.lat, center.lng, useMyLocation ? '내 주변' : regionTitle)}
                >
                  {busy ? '계산 중' : '이 지역 분석'}
                </button>
              </form>
              {guideOpen && mapView && guideMatches(mapView, selectRequest, ranked) ? (
                <div className="guide-column">
                  {guidePlaceCall(ranked, selectRequest) && <p className={`guide-call call-${guidePlaceCall(ranked, selectRequest)}`}>{callText(ranked, selectRequest)}</p>}
                  <GuidePanel
                    kicker={mapView.roleLabel}
                    name={mapView.name}
                    address={mapView.address}
                    time={mapView.time}
                    coords={mapView.coords}
                    lead={mapView.guide.lead}
                    blocks={mapView.guide.blocks}
                    role={mapView.role}
                    markSelection
                    onClose={() => setGuideOpen(false)}
                  />
                  <p className="origin-link">
                    이번 주 원문 ·{' '}
                    <a href={pick.url} target="_blank" rel="noopener noreferrer">
                      페이지 열기
                    </a>
                  </p>
                  <p className="origin-note">자리 안내는 위 섹션이 기준입니다. 사진은 원문 페이지에서만 봅니다.</p>
                  {mapView.role !== 'point' && (
                    <button className="field-btn good" type="button" onClick={() => void saveMineFromGuide()}>
                      내 자리로 저장
                    </button>
                  )}
                </div>
              ) : (
                <RankList title={listTitle} status={status} busy={busy} places={ranked} onOpen={openPlace} />
              )}
              <PublicNotes
                placeName={inJejuBox(center.lat, center.lng) || isJeju(regionName) ? '제주' : regionName}
                center={center}
                radiusKm={prefs.radiusKm}
                nearbyNames={ranked.map((place) => place.name)}
              />
            </div>
          </div>
        )}
        {tab === 'book' && (
          <ReferenceBook
            pick={{ ...pick, scene: weeklyShown }}
            known={KNOWN_REFERENCES.filter((item) => item.id !== pick.id)}
            added={references.map((item) => ({ item, brief: describeAdded(item.url, item.source) }))}
            urlDraft={urlDraft}
            urlError={urlError}
            onUrl={setUrlDraft}
            onAdd={addReference}
            onChoose={chooseScene}
            onRemove={removeReference}
          />
        )}
        {tab === 'mine' && (
          <MyPlaces
            points={sync.points}
            onAnalyze={openPoint}
            onDelete={(point) => {
              void sync.removePoint(point.id);
            }}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen session={session} preferScenes={prefs.preferScenes} onToggleScene={toggleScene} status={status} />
        )}
      </div>
      <nav className="tabbar" aria-label="화면 이동">
        <Nav tab={tab} onTab={setTab} />
      </nav>
    </main>
  );
}

function Nav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'map', label: '지도' },
    { id: 'book', label: '참고' },
    { id: 'mine', label: '내 자리' },
    { id: 'settings', label: '설정' },
  ];
  return (
    <>
      {items.map((item) => (
        <button key={item.id} type="button" className={tab === item.id ? 'on' : ''} aria-pressed={tab === item.id} onClick={() => onTab(item.id)}>
          {item.label}
        </button>
      ))}
    </>
  );
}

function guidePlaceCall(places: RankedPlace[], request: { kind: 'spot'; osm: string } | { kind: 'point'; id: string } | null): string {
  const place = request ? places.find((item) => (request.kind === 'spot' ? item.id === request.osm : item.pointId === request.id)) : undefined;
  return place?.call ?? '';
}

function callText(places: RankedPlace[], request: { kind: 'spot'; osm: string } | { kind: 'point'; id: string } | null): string {
  const place = request ? places.find((item) => (request.kind === 'spot' ? item.id === request.osm : item.pointId === request.id)) : undefined;
  return place?.callTitle ?? '';
}

function guideMatches(
  view: SelectionView,
  request: { kind: 'spot'; osm: string } | { kind: 'point'; id: string } | null,
  places: RankedPlace[],
): boolean {
  if (!request) return false;
  const place = places.find((item) => (request.kind === 'spot' ? item.id === request.osm : item.pointId === request.id));
  if (!place) return false;
  if (view.name !== place.name) return false;
  return request.kind === 'point' ? view.role === 'point' : view.role !== 'point';
}

function viewKey(view: SelectionView | null): string {
  if (!view) return '';
  return `${view.role}|${view.name}|${view.time}|${view.address}|${view.guide.lead}|${view.guide.blocks.map((block) => block.heading + block.body).join('|')}`;
}

function shortTitle(label: string): string {
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] || label;
}
