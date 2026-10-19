import type { FormEvent } from 'react';
import type { ReferenceBrief, WeeklyPick } from './catalog';
import { windowName } from './recommend';
import { SOURCE_NAME } from './sources';
import type { StoredReference } from './storage';
import { FALLBACK_SCENES, type SceneChoice } from './region-places';
import { formatSelection } from './week';

/**
 * 참고 도감입니다. 출처와 장면만 보여주고, 사진은 원문 페이지 링크로만 엽니다.
 * 이번 주 빛에 맞춘 자리 안내는 지도 화면에서 섹션으로 봅니다.
 */
export function ReferenceBook({
  pick,
  known,
  added,
  urlDraft,
  urlError,
  onUrl,
  onAdd,
  onChoose,
  onRemove,
}: {
  pick: WeeklyPick;
  known: ReferenceBrief[];
  added: { item: StoredReference; brief: ReferenceBrief }[];
  urlDraft: string;
  urlError: string | null;
  onUrl: (value: string) => void;
  onAdd: (event: FormEvent) => void;
  onChoose: (id: string, scene: SceneChoice) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="book" data-reference-book aria-labelledby="book-title">
      <h2 id="book-title">참고 도감</h2>
      <p className="book-lead">
        현장에 가기 전에 출처와 장면을 보는 장입니다. 이번 주 빛에 맞춘 자리 안내는 지도에서 자리를 열면 섹션으로 나옵니다. 사진은 원문 페이지만 엽니다.
      </p>
      <article className="book-card week" data-weekly={pick.id}>
        <p className="book-kicker">이번 주 · {formatSelection(pick.startsAt)}</p>
        <h3>{SOURCE_NAME[pick.source]}</h3>
        <Spec name="장면" value={pick.scene ?? '아직 고르지 않음'} />
        <Spec name="근거" value={pick.basis} />
        <Spec name="빛" value={windowName(pick.window)} />
        <p className="book-link">
          <a href={pick.url} target="_blank" rel="noopener noreferrer">
            페이지 열기
          </a>
        </p>
        {!pick.scene && <SceneChoices onChoose={(scene) => onChoose(pick.id, scene)} />}
      </article>
      {known.map((brief) => (
        <article key={brief.id} className="book-card" data-reference={brief.id}>
          <p className="book-kicker">{brief.id === pick.id ? '이번 주 원문' : '도감'}</p>
          <h3>{SOURCE_NAME[brief.source]}</h3>
          <Spec name="장면" value={brief.scene ?? '페이지 글을 읽지 못함'} />
          <Spec name="근거" value={brief.basis} />
          <Spec name="빛" value={windowName(brief.window)} />
          <p className="book-link">
            <a href={brief.url} target="_blank" rel="noopener noreferrer">
              페이지 열기
            </a>
          </p>
        </article>
      ))}
      <h3 className="book-add-title">페이지 주소로 추가</h3>
      <p className="book-lead">1x, 1650Gallery, LensCulture, World Press Photo, 레드불 일루미네이트, 레드불 콘텐츠 풀. 주소만 저장하고 사진은 받아 오지 않습니다.</p>
      <form className="search" id="reference-form" onSubmit={onAdd}>
        <label className="sr" htmlFor="reference-url">
          페이지 주소
        </label>
        <input
          id="reference-url"
          name="url"
          inputMode="url"
          value={urlDraft}
          placeholder="페이지 주소를 붙여 넣기"
          onChange={(event) => onUrl(event.target.value)}
          autoComplete="off"
        />
        <button className="field-btn good" type="submit">
          추가
        </button>
      </form>
      {urlError && <p className="note error">{urlError}</p>}
      {added.map(({ item, brief }) => (
        <article key={item.id} className="book-card" data-added-reference={brief.url}>
          <p className="book-kicker">{SOURCE_NAME[brief.source]}</p>
          <Spec name="장면" value={item.sceneChoice ?? brief.scene ?? '아직 고르지 않음'} />
          <Spec name="근거" value={brief.basis} />
          <p className="book-link">
            <a href={brief.url} target="_blank" rel="noopener noreferrer">
              페이지 열기
            </a>
          </p>
          {!brief.scene && !item.sceneChoice && <SceneChoices onChoose={(scene) => onChoose(item.id, scene)} />}
          <button className="field-btn" type="button" onClick={() => onRemove(item.id)}>
            빼기
          </button>
        </article>
      ))}
    </section>
  );
}

function Spec({ name, value }: { name: string; value: string }) {
  return (
    <p className="book-spec">
      <span>{name}</span>
      {value}
    </p>
  );
}

function SceneChoices({ onChoose }: { onChoose: (scene: SceneChoice) => void }) {
  return (
    <div className="scene-choices" role="group" aria-label="장면">
      {FALLBACK_SCENES.map((choice) => (
        <button key={choice} type="button" className="field-btn" onClick={() => onChoose(choice)}>
          {choice}
        </button>
      ))}
    </div>
  );
}
