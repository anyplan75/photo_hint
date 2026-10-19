import { AccountPanel } from './AccountPanel';
import { FALLBACK_SCENES, type SceneChoice } from './region-places';
import type { Session } from './session';

/** 계정과 장면 선호입니다. 지도 암호는 페이지 작업 환경에 있고, 이 화면에 붙여 넣지 않습니다. */
export function SettingsScreen({
  session,
  preferScenes,
  onToggleScene,
  status,
}: {
  session: Session;
  preferScenes: SceneChoice[];
  onToggleScene: (scene: SceneChoice) => void;
  status: string;
}) {
  return (
    <section className="book" data-settings aria-labelledby="settings-title">
      <h2 id="settings-title">설정</h2>
      <p className="book-lead">촬영 지점은 이메일 로그인으로 맞춥니다. 지도 공개 토큰은 페이지를 만드는 작업 환경에 두며, 이 화면에 적지 않습니다.</p>
      <AccountPanel session={session} />
      <h3>노리는 장면</h3>
      <p className="book-lead">{preferScenes.length === 0 ? '비워 두면 이번 주 일요일 오전 9시 선정의 장면을 씁니다.' : '고른 장면만 점수를 매깁니다.'}</p>
      <div className="scene-choices" role="group" aria-label="노리는 장면">
        {FALLBACK_SCENES.map((scene) => (
          <button
            key={scene}
            type="button"
            className={preferScenes.includes(scene) ? 'field-btn good' : 'field-btn'}
            aria-pressed={preferScenes.includes(scene)}
            onClick={() => onToggleScene(scene)}
          >
            {scene}
          </button>
        ))}
      </div>
      <article className="book-card">
        <h3>분석이 보는 것</h3>
        <p>
          반경 안의 공개된 장소와, 제주에서 확인한 자리를 이번 주 장면과 해의 방향으로 점수를 매깁니다. 높은 점수가 목록 위에 옵니다. 저장한 촬영 지점은 반경 밖이어도 남습니다.
        </p>
        <p>자리 안내는 준비, 시간, 렌즈, 장비, 자리, 순간 중 하나만 보여 줍니다. 참고 사진의 원문은 페이지 링크로만 엽니다.</p>
      </article>
      <p className="book-lead">그때 그자리</p>
      <p className="book-lead">{status}</p>
    </section>
  );
}
