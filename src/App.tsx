import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { describeAdded, weeklyPick, windowForScene, type ReferenceBrief } from './catalog';
import { aimFor, recommendTime } from './recommend';
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
  const pick = useMemo(() => weeklyPick(now), [now]);
  const checked = region ? spotsForRegion(region.name) : null;
  const spots = checked ?? remoteSpots;

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

  const waiting = Boolean(region && !checked && remoteState === 'loading');
  const missing = Boolean(region && !checked && remoteState === 'missing');

  return (
    <main className="app">
      <header className="mast">
        <p className="mark">촬영 참고</p>
        <h1>그때 그자리</h1>
        <p className="lede">지역을 정하면, 그 지역의 실제 자리와 해의 시간을 골라 줍니다.</p>
      </header>

      <section className="panel" aria-labelledby="region-title">
        <div className="panel-head">
          <h2 id="region-title">지역</h2>
          <p>브라우저에만 남습니다. 계정은 없습니다.</p>
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

      {region ? (
        <>
          <WeeklyCard
            pick={pick}
            scene={pick.scene ?? weeklyChoice}
            spots={spots}
            now={now}
            waiting={waiting}
            missing={missing}
            onChoose={setWeeklyChoice}
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
        <p className="note">지역을 정하면 이번 주 링크와, 그 지역에서 시도할 자리가 나옵니다.</p>
      )}
    </main>
  );
}

function WeeklyCard({
  pick,
  scene,
  spots,
  now,
  waiting,
  missing,
  onChoose,
}: {
  pick: ReferenceBrief & { startsAt: string };
  scene: SceneChoice | null;
  spots: Spot[];
  now: Date;
  waiting: boolean;
  missing: boolean;
  onChoose: (scene: SceneChoice) => void;
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
      <PlaceAdvice brief={pick} scene={scene} spots={spots} now={now} waiting={waiting} missing={missing} onChoose={onChoose} />
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
      <PlaceAdvice brief={brief} scene={scene} spots={spots} now={now} waiting={waiting} missing={missing} onChoose={onChoose} />
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
  onChoose,
}: {
  brief: ReferenceBrief;
  scene: SceneChoice | null;
  spots: Spot[];
  now: Date;
  waiting: boolean;
  missing: boolean;
  onChoose: (scene: SceneChoice) => void;
}) {
  const windowKind = scene ? windowForScene(scene, brief.window) : brief.window;
  const chosen = scene ? pickSpots(scene, spots, aimFor(windowKind)) : [];
  const [selected, setSelected] = useState(chosen[0]?.osm ?? '');
  const active = chosen.some((spot) => spot.osm === selected) ? selected : chosen[0]?.osm;
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
        <ul className="spot-list">
          {chosen.map((spot) => (
            <li key={spot.osm} className={active === spot.osm ? 'on' : ''}>
              <button type="button" className="spot-pick" aria-pressed={active === spot.osm} onClick={() => setSelected(spot.osm)}>
                <strong data-place>{spot.name}</strong>
                <span data-match>{matchLabel(scene as SceneChoice, spot)}</span>
              </button>
              <p data-address>{spot.address ?? '주소를 찾지 못했습니다.'}</p>
              <p data-why>{whySpot(scene as SceneChoice, spot)}</p>
              <p data-time>{recommendTime(spot.lat, spot.lng, windowKind, now)}</p>
              <p className="dim">
                {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)} · {spot.osm}
              </p>
            </li>
          ))}
        </ul>
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
