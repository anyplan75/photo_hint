import type { ShootPoint } from './shoot-points';

/** 계정 또는 이 브라우저에 저장한 촬영 지점입니다. */
export function MyPlaces({
  points,
  onAnalyze,
  onDelete,
}: {
  points: ShootPoint[];
  onAnalyze: (point: ShootPoint) => void;
  onDelete: (point: ShootPoint) => void;
}) {
  return (
    <section className="book" data-my-places aria-labelledby="mine-title">
      <h2 id="mine-title">내 자리</h2>
      <p className="book-lead">내가 이름을 붙여 저장한 촬영 지점입니다. 반경 밖이어도 지도의 점수 목록에 같이 들어갑니다. 로그인한 계정으로 맥, 아이폰, 웹사이트가 맞춰집니다.</p>
      {points.length === 0 && <p className="book-lead">아직 없습니다. 지도의 빈 곳을 눌러 이름을 저장하거나, 자리 안내에서 내 자리로 저장을 누르세요.</p>}
      {points.map((point) => (
        <article key={point.id} className="book-card" data-user-point={point.name}>
          <h3>{point.name}</h3>
          <p className="book-spec">
            <span>좌표</span>
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </p>
          {point.note && <p className="book-lead">{point.note}</p>}
          <div className="row-actions">
            <button className="field-btn good" type="button" onClick={() => onAnalyze(point)}>
              분석
            </button>
            <button className="field-btn bad" type="button" onClick={() => onDelete(point)}>
              삭제
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
