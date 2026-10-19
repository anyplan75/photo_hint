import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { describeAdded, weeklyPick, windowForScene, type ReferenceBrief } from './catalog';
import { shootingGuide } from './guide';
import { aimFor, recommendTime, sunPlan } from './recommend';
import {
  FALLBACK_SCENES,
  isJeju,
  loadSpotsAround,
  matchLabel,
  pickSpots,
  spotCounts,
  spotsForRegion,
  whySpot,
  type SceneChoice,
  type Spot,
} from './region-places';
import { AccountPanel } from './AccountPanel';
import { GuidePanel } from './GuidePanel';
import { useSession } from './session';
import { ShootMap, type SelectionView } from './ShootMap';
import { searchPlaces } from './search';
import { SOURCE_NAME, parseReferenceAddress, referenceKey } from './sources';
import {
  loadReferences,
  loadRegion,
  writeReferences,
  writeRegion,
  type StoredReference,
  type StoredRegion,
} from './storage';
import { formatSelection } from './week';

export function App() {
  const [now] = useState(() => new Date());
  const [region, setRegion] = useState<StoredRegion | null>(() => loadRegion());
  const [regionDraft, setRegionDraft] = useState('');
  const [regionError, setRegionError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [references, setReferences] = useState<StoredReference[]>(() => loadReferences());
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [remoteSpots, setRemoteSpots] = useState<Spot[]>([]);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'missing' | 'ready'>('idle');
  const [weeklyChoice, setWeeklyChoice] = useState<SceneChoice | null>(null);
  const [weeklyOsm, setWeeklyOsm] = useState('');
  const pick = useMemo(() => weeklyPick(now), [now]);
  const checked = region ? spotsForRegion(region.name) : null;
  const spots = checked ?? remoteSpots;
  const weeklyScene = pick.scene ?? weeklyChoice;
  const weeklyWindow = weeklyScene ? windowForScene(weeklyScene, pick.window) : pick.window;
  const weeklySpots = useMemo(
    () => (weeklyScene ? pickSpots(weeklyScene, spots, aimFor(weeklyWindow)) : []),
    [weeklyScene, spots, weeklyWindow],
  );
  const weeklyActive = weeklySpots.some((spot) => spot.osm === weeklyOsm) ? weeklyOsm : (weeklySpots[0]?.osm ?? '');

  useEffect(() => {
    if (!region || checked) {
      setRemoteSpots([]);
      setRemoteState('idle');
      return;
    }
    if (region.south === null || region.west === null || region.north === null || region.east === null) {
      setRemoteSpots([]);
      setRemoteState('missing');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setRemoteState('loading');
    loadSpotsAround(region.south, region.west, region.north, region.east, controller.signal)
      .then((found) => {
        setRemoteSpots(found);
        setRemoteState(found.length > 0 ? 'ready' : 'missing');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setRemoteSpots([]);
        setRemoteState('missing');
      });
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [region, checked]);

  async function saveRegion(event: FormEvent) {
    event.preventDefault();
    const name = regionDraft.trim();
    if (!name) {
      setRegionError('지역 이름을 입력하세요.');
      return;
    }
    setFinding(true);
    setRegionError(null);
    const controller = new AbortController();
    try {
      const hits = await searchPlaces(name, controller.signal);
      const hit = hits[0];
      const next: StoredRegion = {
        name,
        label: hit?.label ?? '',
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        south: hit?.south ?? null,
        north: hit?.north ?? null,
        west: hit?.west ?? null,
        east: hit?.east ?? null,
        savedAt: new Date().toISOString(),
      };
      writeRegion(next);
      setRegion(next);
      setRegionDraft('');
      if (!hit && !isJeju(name)) setRegionError('그 지역을 찾지 못했습니다.');
    } catch {
      if (isJeju(name)) {
        const next: StoredRegion = {
          name,
          label: '',
          lat: null,
          lng: null,
          south: null,
          north: null,
          west: null,
          east: null,
          savedAt: new Date().toISOString(),
        };
        writeRegion(next);
        setRegion(next);
        setRegionDraft('');
      } else {
        setRegionError('지역을 찾지 못했습니다. 잠시 뒤 다시 시도하세요.');
      }
    } finally {
      setFinding(false);
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

  function chooseScene(id: string, scene: SceneChoice) {
    const next = references.map((item) => (item.id === id ? { ...item, sceneChoice: scene } : item));
    writeReferences(next);
    setReferences(next);
  }

  function removeReference(id: string) {
    const next = references.filter((item) => item.id !== id);
    writeReferences(next);
    setReferences(next);
  }

  const session = useSession();
  const waiting = Boolean(region && !checked && remoteState === 'loading');
  const missing = Boolean(region && !checked && remoteState === 'missing');
  const [shelf, setShelf] = useState<Shelf>('guide');
  const [mapView, setMapView] = useState<SelectionView | null>(null);
  const [dismissPoint, setDismissPoint] = useState(0);
  const rememberView = useCallback((view: SelectionView | null) => {
    setMapView((current) => (viewKey(current) === viewKey(view) ? current : view));
  }, []);

  useEffect(() => {
    if (!region) setShelf('region');
  }, [region]);

  function toggleShelf(next: Shelf) {
    setShelf((current) => (current === next ? 'guide' : next));
  }

  return (
    <main className="app">
      <header className="chrome">
        <div className="brand">
          <p className="mark">촬영 참고</p>
          <h1>그때 그자리</h1>
        </div>
        <nav className="chrome-nav" aria-label="화면 이동">
          <button type="button" className={shelf === 'guide' ? 'on' : ''} aria-pressed={shelf === 'guide'} onClick={() => toggleShelf('guide')}>
            안내
          </button>
          <button type="button" className={shelf === 'account' ? 'on' : ''} aria-pressed={shelf === 'account'} onClick={() => toggleShelf('account')}>
            계정
          </button>
          <button
            type="button"
            className={shelf === 'region' ? 'on' : ''}
            aria-pressed={shelf === 'region'}
            aria-label={region ? `지역, ${region.name}` : '지역'}
            onClick={() => toggleShelf('region')}
          >
            {region ? region.name : '지역'}
          </button>
          <button type="button" className={shelf === 'week' ? 'on' : ''} aria-pressed={shelf === 'week'} onClick={() => toggleShelf('week')}>
            이번 주
          </button>
        </nav>
      </header>

      <section className="map-stage" aria-label="지도 영역">
        {region ? (
          <ShootMap
            region={region.name}
            center={region.lat !== null && region.lng !== null ? { lat: region.lat, lng: region.lng } : null}
            spots={weeklySpots}
            activeOsm={weeklyActive}
            onSelect={setWeeklyOsm}
            scene={weeklyScene}
            basis={pick.basis}
            windowKind={weeklyWindow}
            now={now}
            sessionReady={session.ready}
            uid={session.uid}
            onView={rememberView}
            onOpenGuide={() => setShelf('guide')}
            dismissPoint={dismissPoint}
          />
        ) : (
          <section className="shoot-map panel map-empty" data-map="waiting">
            <div className="panel-head">
              <h2>지도</h2>
              <p>지역을 정하면 그 자리의 지도가 이 화면에 남습니다.</p>
            </div>
          </section>
        )}
      </section>

      <section className="read-shelf" aria-label="안내와 설정" data-shelf={shelf}>
      {shelf === 'account' && <AccountPanel session={session} />}

      {shelf === 'region' && (
      <section className="panel region-panel" aria-labelledby="region-title">
        <div className="panel-head">
          <h2 id="region-title">지역</h2>
          <p>지역 이름은 이 브라우저에 남습니다. 지도에 저장한 촬영 지점은 로그인한 계정으로 맞춰집니다.</p>
        </div>
        {region && (
          <p className="where-kicker" data-region={region.name}>
            {region.name}
            {region.label ? ` · ${shortLabel(region.label)}` : ''}
          </p>
        )}
        {checked && <p className="note">OpenStreetMap · {spotCounts(checked)}</p>}
        <form className="search" id="region-form" onSubmit={saveRegion}>
          <label className="sr" htmlFor="region-name">
            지역 이름
          </label>
          <input
            id="region-name"
            name="region"
            value={regionDraft}
            placeholder="예: 제주"
            onChange={(event) => setRegionDraft(event.target.value)}
            autoComplete="off"
          />
          <button className="ghost slim" type="submit" disabled={finding}>
            {finding ? '찾는 중' : region ? '바꾸기' : '이 지역으로'}
          </button>
        </form>
        {regionError && <p className="note error">{regionError}</p>}
      </section>
      )}

      {shelf === 'week' && (region ? (
        <>
          <WeeklyCard
            pick={pick}
            scene={weeklyScene}
            spots={spots}
            now={now}
            waiting={waiting}
            missing={missing}
            selectedOsm={weeklyActive}
            onChoose={setWeeklyChoice}
            onSelect={(osm) => {
              setWeeklyOsm(osm);
              setShelf('guide');
            }}
          />
          <section className="favorites" aria-labelledby="add-title">
            <h2 id="add-title">페이지 주소로 추가</h2>
            <p className="day-line">1x, 1650Gallery, LensCulture, World Press Photo, 레드불 일루미네이트, 레드불 콘텐츠 풀.</p>
            <form className="search" id="reference-form" onSubmit={addReference}>
              <label className="sr" htmlFor="reference-url">
                페이지 주소
              </label>
              <input
                id="reference-url"
                name="url"
                inputMode="url"
                value={urlDraft}
                placeholder="페이지 주소를 붙여 넣기"
                onChange={(event) => setUrlDraft(event.target.value)}
                autoComplete="off"
              />
              <button className="ghost slim" type="submit">
                추가
              </button>
            </form>
            {urlError && <p className="note error">{urlError}</p>}
            {references.map((item) => {
              const brief = describeAdded(item.url, item.source);
              return (
                <ReferenceCard
                  key={item.id}
                  brief={brief}
                  scene={item.sceneChoice ?? brief.scene}
                  spots={spots}
                  now={now}
                  waiting={waiting}
                  missing={missing}
                  onChoose={(scene) => chooseScene(item.id, scene)}
                  onRemove={() => removeReference(item.id)}
                />
              );
            })}
          </section>
        </>
      ) : (
        <p className="note empty-region">지역을 정하면 이번 주 링크와, 그 지역에서 시도할 자리가 나옵니다.</p>
      ))}

      {shelf === 'guide' && (
        mapView ? (
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
            onClose={mapView.role === 'point' ? () => setDismissPoint((count) => count + 1) : undefined}
          />
        ) : (
          <article className="guide-panel guide-empty">
            <h2>안내</h2>
            <p>{region ? '핀을 누르면 그 자리의 안내가 섹션으로 열립니다.' : '지역을 정하면 지도와 안내가 열립니다.'}</p>
          </article>
        )
      )}
      </section>
    </main>
  );
}

type Shelf = 'guide' | 'account' | 'region' | 'week';

function viewKey(view: SelectionView | null): string {
  if (!view) return '';
  return `${view.role}|${view.name}|${view.time}|${view.address}|${view.guide.lead}|${view.guide.blocks.map((block) => block.heading + block.body).join('|')}`;
}

function WeeklyCard({
  pick,
  scene,
  spots,
  now,
  waiting,
  missing,
  selectedOsm,
  onChoose,
  onSelect,
}: {
  pick: ReferenceBrief & { startsAt: string };
  scene: SceneChoice | null;
  spots: Spot[];
  now: Date;
  waiting: boolean;
  missing: boolean;
  selectedOsm: string;
  onChoose: (scene: SceneChoice) => void;
  onSelect: (osm: string) => void;
}) {
  return (
    <article className="shot" id="weekly-pick" data-weekly={pick.id} aria-labelledby="weekly-title">
      <p className="shot-kicker">
        {formatSelection(pick.startsAt)}
        {holdsUntilNextSunday(pick.startsAt, now) ? ' · 다음 일요일 오전 9시까지' : ''}
      </p>
      <h2 id="weekly-title">{SOURCE_NAME[pick.source]}</h2>
      <p className="summary">
        <a href={pick.url} target="_blank" rel="noopener noreferrer">
          페이지 열기
        </a>
      </p>
      <PlaceAdvice
        brief={pick}
        scene={scene}
        spots={spots}
        now={now}
        waiting={waiting}
        missing={missing}
        selectedOsm={selectedOsm}
        onChoose={onChoose}
        onSelect={onSelect}
      />
    </article>
  );
}

function ReferenceCard({
  brief,
  scene,
  spots,
  now,
  waiting,
  missing,
  onChoose,
  onRemove,
}: {
  brief: ReferenceBrief;
  scene: SceneChoice | null;
  spots: Spot[];
  now: Date;
  waiting: boolean;
  missing: boolean;
  onChoose: (scene: SceneChoice) => void;
  onRemove: () => void;
}) {
  return (
    <article className="shot" data-added-reference={brief.url}>
      <p className="shot-kicker" data-source={brief.source}>
        {SOURCE_NAME[brief.source]}
      </p>
      <p className="summary">
        <a href={brief.url} target="_blank" rel="noopener noreferrer">
          {brief.url}
        </a>
      </p>
      <PlaceAdvice brief={brief} scene={scene} spots={spots} now={now} waiting={waiting} missing={missing} onChoose={onChoose} embedGuide />
      <button className="save" type="button" onClick={onRemove}>
        빼기
      </button>
    </article>
  );
}

function PlaceAdvice({
  brief,
  scene,
  spots,
  now,
  waiting,
  missing,
  selectedOsm,
  onChoose,
  onSelect,
  embedGuide = false,
}: {
  brief: ReferenceBrief;
  scene: SceneChoice | null;
  spots: Spot[];
  now: Date;
  waiting: boolean;
  missing: boolean;
  selectedOsm?: string;
  onChoose: (scene: SceneChoice) => void;
  onSelect?: (osm: string) => void;
  embedGuide?: boolean;
}) {
  const windowKind = scene ? windowForScene(scene, brief.window) : brief.window;
  const chosen = scene ? pickSpots(scene, spots, aimFor(windowKind)) : [];
  const [localSelected, setLocalSelected] = useState(chosen[0]?.osm ?? '');
  const selected = selectedOsm !== undefined ? selectedOsm : localSelected;
  const active = chosen.some((spot) => spot.osm === selected) ? selected : chosen[0]?.osm;
  function choose(osm: string) {
    setLocalSelected(osm);
    onSelect?.(osm);
  }
  const activeSpot = chosen.find((spot) => spot.osm === active);
  const guide = scene && activeSpot ? shootingGuide(scene, brief.basis, activeSpot, sunPlan(activeSpot.lat, activeSpot.lng, windowKind, now)) : null;
  return (
    <div className="method" data-method>
      <h4>장면</h4>
      {scene ? (
        <p data-scene>
          {scene} · {brief.basis}
        </p>
      ) : (
        <>
          <p>페이지 글을 읽지 못했습니다. 장면을 고르세요.</p>
          <div className="chips" role="group" aria-label="장면">
            {FALLBACK_SCENES.map((choice) => (
              <button key={choice} type="button" className="chip" onClick={() => onChoose(choice)}>
                {choice}
              </button>
            ))}
          </div>
        </>
      )}
      <h4>장소</h4>
      {waiting && <p>이 지역의 장소를 찾는 중입니다.</p>}
      {!waiting && missing && <p data-place-missing>이 지역의 장소 자료를 찾지 못했습니다.</p>}
      {!waiting && !missing && scene && spots.length === 0 && (
        <p data-place-missing>이 장면에 맞는 장소 자료를 찾지 못했습니다.</p>
      )}
      {chosen.length > 0 && (
        <div className="place-chips" role="group" aria-label="장소">
          {chosen.map((spot) => (
            <button
              key={spot.osm}
              type="button"
              className={active === spot.osm ? 'on' : ''}
              aria-pressed={active === spot.osm}
              data-place-option={spot.name}
              onClick={() => choose(spot.osm)}
            >
              {spot.name}
            </button>
          ))}
        </div>
      )}
      {activeSpot && scene && (
        <>
          <p data-match>{matchLabel(scene, activeSpot)}</p>
          <p data-why>{whySpot(scene, activeSpot)}</p>
        </>
      )}
      {embedGuide && guide && activeSpot && (
        <GuidePanel
          kicker={scene ?? '장면'}
          name={activeSpot.name}
          address={activeSpot.address ?? '주소를 찾지 못했습니다.'}
          time={recommendTime(activeSpot.lat, activeSpot.lng, windowKind, now)}
          coords={`${activeSpot.lat.toFixed(5)}, ${activeSpot.lng.toFixed(5)} · ${activeSpot.osm}`}
          lead={guide.lead}
          blocks={guide.blocks}
        />
      )}
    </div>
  );
}

function holdsUntilNextSunday(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime() + 7 * 24 * 60 * 60 * 1000;
}

function shortLabel(label: string): string {
  return label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}
