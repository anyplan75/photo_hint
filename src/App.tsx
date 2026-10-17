import { useMemo, useState, type FormEvent } from 'react';
import { describeAdded, fillRegion, weeklyPick, type ReferenceCopy } from './catalog';
import { recommendTime, windowName } from './recommend';
import { searchPlaces } from './search';
import { SOURCE_NAME, parseReferenceAddress, referenceKey } from './sources';
import { loadReferences, loadRegion, writeReferences, writeRegion, type StoredReference, type StoredRegion } from './storage';
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
  const pick = useMemo(() => weeklyPick(now), [now]);

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
        savedAt: new Date().toISOString(),
      };
      writeRegion(next);
      setRegion(next);
      setRegionDraft('');
      if (!hit) setRegionError('그 지역을 찾지 못했습니다. 이름은 저장했고, 시계 시각은 빠집니다.');
    } catch {
      setRegionError('지역을 찾지 못했습니다. 잠시 뒤 다시 시도하세요.');
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

  function removeReference(id: string) {
    const next = references.filter((item) => item.id !== id);
    writeReferences(next);
    setReferences(next);
  }

  return (
    <main className="app">
      <header className="mast">
        <p className="mark">촬영 참고</p>
        <h1>그때 그자리</h1>
        <p className="lede">지역을 정하면, 시도해 볼 사진과 그 자리·시간을 골라 줍니다.</p>
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
        <form className="search" id="region-form" onSubmit={saveRegion}>
          <label className="sr" htmlFor="region-name">
            지역 이름
          </label>
          <input
            id="region-name"
            name="region"
            value={regionDraft}
            placeholder="예: 부산 해운대"
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
          <WeeklyCard pick={pick} region={region} now={now} />
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
            {references.map((item) => (
              <ReferenceCard
                key={item.id}
                copy={describeAdded(item.url, item.source)}
                region={region}
                now={now}
                onRemove={() => removeReference(item.id)}
              />
            ))}
          </section>
        </>
      ) : (
        <p className="note">지역을 정하면 이번 주의 사진과 찍는 방법이 나옵니다.</p>
      )}
    </main>
  );
}

function WeeklyCard({ pick, region, now }: { pick: ReferenceCopy & { startsAt: string }; region: StoredRegion; now: Date }) {
  return (
    <article className="shot" id="weekly-pick" data-weekly={pick.id} aria-labelledby="weekly-title">
      <p className="shot-kicker">
        {formatSelection(pick.startsAt)}
        {holdsUntilNextSunday(pick.startsAt, now) ? ' · 다음 일요일 오전 9시까지' : ''}
      </p>
      <h2 id="weekly-title">{SOURCE_NAME[pick.source]}</h2>
      <p className="summary" data-weekly-scene>
        {pick.scene}
      </p>
      <p className="summary">
        <a href={pick.url} target="_blank" rel="noopener noreferrer">
          페이지 열기
        </a>
      </p>
      <Advice copy={pick} region={region} now={now} full />
    </article>
  );
}

function ReferenceCard({
  copy,
  region,
  now,
  onRemove,
}: {
  copy: ReferenceCopy;
  region: StoredRegion;
  now: Date;
  onRemove: () => void;
}) {
  return (
    <article className="shot" data-added-reference={copy.url}>
      <p className="shot-kicker" data-source={copy.source}>
        {SOURCE_NAME[copy.source]}
      </p>
      <h3>고른 페이지</h3>
      <p className="summary">{copy.scene}</p>
      <p className="summary">
        <a href={copy.url} target="_blank" rel="noopener noreferrer">
          {copy.url}
        </a>
      </p>
      <Advice copy={copy} region={region} now={now} full={false} />
      <button className="save" type="button" onClick={onRemove}>
        빼기
      </button>
    </article>
  );
}

function Advice({ copy, region, now, full }: { copy: ReferenceCopy; region: StoredRegion; now: Date; full: boolean }) {
  const place = fillRegion(copy.place, region.name);
  const time =
    region.lat !== null && region.lng !== null ? recommendTime(region.lat, region.lng, copy.window, now) : windowFallback(copy);
  return (
    <div className="method" data-method>
      <h4>장소</h4>
      <p data-place>{place}</p>
      <h4>시간</h4>
      <p data-time>{time}</p>
      <h4>찍는 방법</h4>
      <p>{copy.method}</p>
      {full && (
        <>
          <h4>빛</h4>
          <p>{copy.light}</p>
          <h4>서는 자리</h4>
          <p>{copy.stand}</p>
          <h4>기다리는 것</h4>
          <p>{copy.wait}</p>
          <h4>거리</h4>
          <p>{copy.distance}</p>
        </>
      )}
    </div>
  );
}

function holdsUntilNextSunday(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime() + 7 * 24 * 60 * 60 * 1000;
}

function windowFallback(copy: ReferenceCopy): string {
  return `${windowName(copy.window)} · 좌표가 없어 시계 시각은 빠집니다.`;
}

function shortLabel(label: string): string {
  const parts = label.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 3).join(', ');
}
