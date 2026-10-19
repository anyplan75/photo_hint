import { useEffect, useId, useMemo, useState } from 'react';
import type { GuideBlock } from './guide';

/** 안내 문장을 한 화면에 한 묶음만 보여 주기 위한 이름표입니다. */
const TABS: { id: string; label: string; headings: string[] }[] = [
  { id: 'prep', label: '준비', headings: ['준비'] },
  { id: 'time', label: '시간', headings: ['도착', '빛의 방향'] },
  { id: 'lens', label: '렌즈', headings: ['렌즈'] },
  { id: 'gear', label: '장비', headings: ['장비'] },
  { id: 'stand', label: '자리', headings: ['서는 자리', '거리'] },
  { id: 'moment', label: '순간', headings: ['기다리는 것', '피할 조건'] },
];

/**
 * 고른 장소의 촬영 안내를 준비, 시간, 렌즈처럼 짧게 나눠 하나만 보여 줍니다.
 * 문장 내용은 그대로 두고, 긴 목록을 한꺼번에 늘어놓지 않습니다.
 */
export function GuidePanel({
  kicker,
  name,
  address,
  time,
  coords,
  lead,
  blocks,
  role,
  onClose,
  markSelection = false,
}: {
  kicker: string;
  name: string;
  address: string;
  time: string;
  coords: string;
  lead: string;
  blocks: GuideBlock[];
  role?: string;
  onClose?: () => void;
  /** 지도에서 고른 자리의 안내 칸일 때만 식별자를 붙입니다. */
  markSelection?: boolean;
}) {
  const baseId = useId();
  const tabs = useMemo(() => groupGuide(blocks, time), [blocks, time]);
  const [tabId, setTabId] = useState(tabs[0]?.id ?? 'prep');
  const current = tabs.find((tab) => tab.id === tabId) ?? tabs[0];

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === tabId)) setTabId(tabs[0]?.id ?? 'prep');
  }, [tabs, tabId]);

  if (!current) {
    return (
      <article className="guide-panel" data-guide data-guide-address={address}>
        <h2 data-place>{name}</h2>
        <p>이 자리의 안내 문장이 없습니다.</p>
      </article>
    );
  }

  return (
    <article
      className="guide-panel"
      id={markSelection ? 'map-selection' : undefined}
      data-map-info={markSelection ? '' : undefined}
      data-map-info-role={markSelection ? (role ?? '') : undefined}
      data-guide
      data-guide-address={address}
      aria-labelledby={`${baseId}-title`}
    >
      <div className="guide-head">
        <div>
          <p className="guide-kicker">{kicker}</p>
          <h2 id={`${baseId}-title`} data-place>
            {name}
          </h2>
        </div>
        {onClose && (
          <button type="button" className="map-info-close" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
      <p className="guide-address" data-address>
        {address}
      </p>
      <div className="guide-tabs" role="tablist" aria-label="촬영 안내 섹션" data-guide-tabs>
        {tabs.map((tab) => {
          const selected = current.id === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? 'on' : ''}
              onClick={() => setTabId(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="guide-copy"
        data-guide-section={current.label}
        data-time={current.id === 'time' ? time : undefined}
      >
        {current.id === 'prep' && lead ? <p data-guide-lead>{lead}</p> : null}
        {current.parts.map((part) => (
          <div key={part.heading}>
            {current.parts.length > 1 || part.heading !== current.label ? <h3>{part.heading}</h3> : null}
            <p>{part.body}</p>
          </div>
        ))}
        {current.id === 'stand' && coords ? <p className="dim">{coords}</p> : null}
      </div>
    </article>
  );
}

function groupGuide(blocks: GuideBlock[], time: string): { id: string; label: string; parts: GuideBlock[] }[] {
  const used = new Set<string>();
  const grouped = TABS.map((tab) => {
    const parts = blocks.filter((block) => tab.headings.includes(block.heading));
    for (const part of parts) used.add(part.heading);
    return { id: tab.id, label: tab.label, parts };
  }).filter((tab) => tab.parts.length > 0 || (tab.id === 'time' && time.trim().length > 0));
  const rest = blocks.filter((block) => !used.has(block.heading));
  if (rest.length === 0) return grouped;
  const prep = grouped.find((tab) => tab.id === 'prep');
  if (prep) prep.parts = [...prep.parts, ...rest];
  else grouped.unshift({ id: 'prep', label: '준비', parts: rest });
  return grouped;
}
