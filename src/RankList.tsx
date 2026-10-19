import { distanceLabel, type RankedPlace } from './collect';

/** 점수 순 목록입니다. 높은 점수가 위에 옵니다. */
export function RankList({
  title,
  status,
  busy,
  places,
  onOpen,
}: {
  title: string;
  status: string;
  busy: boolean;
  places: RankedPlace[];
  onOpen: (place: RankedPlace) => void;
}) {
  return (
    <div className="rank-list" data-rank-list>
      <div className="rank-head">
        <h2>{title}</h2>
        {busy && <span className="rank-busy">계산 중</span>}
      </div>
      <p className="rank-status">{status}</p>
      <div className="rank-cards">
        {places.map((place) => (
          <button key={place.id} type="button" className={`rank-card call-${place.call}`} data-rank={place.name} onClick={() => onOpen(place)}>
            <span className="rank-top">
              <span className="rank-call">{place.callTitle}</span>
              <span className="rank-score">{place.score}</span>
            </span>
            <span className="rank-name">{place.name}</span>
            <span className="rank-headline">{place.headline}</span>
            <span className="rank-meta">
              {place.kindLabel}
              {place.distanceKm !== null ? ` · ${distanceLabel(place.distanceKm)}` : ''}
              {place.mine ? ' · 내 자리' : ''}
            </span>
            <span className="rank-now">{place.nowLine}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
