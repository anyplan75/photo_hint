import type { WindowKind } from './places';
import type { SceneChoice } from './region-places';
import type { SourceId } from './sources';
import { referenceKey } from './sources';
import { pickForInstant, type DatedPick } from './week';

export interface ReferenceBrief {
  id: string;
  source: SourceId;
  url: string;
  /** Null when the linked page's words could not be read. */
  scene: SceneChoice | null;
  basis: string;
  window: WindowKind;
}

export interface WeeklyPick extends ReferenceBrief, DatedPick {
  startsAt: string;
}

const rural: ReferenceBrief = {
  id: 'rural-quiet',
  source: '1x',
  url: 'https://1x.com/magazine/permalink/9820',
  scene: '들판',
  basis: '페이지 제목 Rural landscapes',
  window: 'evening-golden',
};

const autumn: ReferenceBrief = {
  id: 'autumn-leaves',
  source: '1x',
  url: 'https://1x.com/magazine/permalink/9852',
  scene: '오름',
  basis: '페이지 제목 Autumn foliage and landscapes',
  window: 'morning-golden',
};

const monarchs: ReferenceBrief = {
  id: 'clustered-wings',
  source: 'worldpress',
  url: 'https://www.worldpressphoto.org/collection/photo-contest/2024/Jaime-Rojo/1',
  scene: '들판',
  basis: '페이지 글의 sanctuary',
  window: 'morning-golden',
};

const walker: ReferenceBrief = {
  id: 'dry-crossing',
  source: 'worldpress',
  url: 'https://www.worldpressphoto.org/collection/photo-contest/2024/Lalo-de-Almeida/1',
  scene: '사람',
  basis: '페이지 글의 walks',
  window: 'sunset-20',
};

const night: ReferenceBrief = {
  id: 'one-lamp',
  source: '1x',
  url: 'https://1x.com/gallery/night',
  scene: '밤',
  basis: '페이지 분류 Night',
  window: 'evening-blue',
};

const movingFigure: ReferenceBrief = {
  id: 'wide-motion',
  source: 'contentpool',
  url: 'https://www.redbullcontentpool.com/',
  scene: null,
  basis: '페이지 글을 읽지 못함',
  window: 'sunrise-20',
};

const street: ReferenceBrief = {
  id: 'street-edge',
  source: '1x',
  url: 'https://1x.com/gallery/street',
  scene: '거리',
  basis: '페이지 분류 Street',
  window: 'morning-golden',
};

const openLand: ReferenceBrief = {
  id: 'open-land',
  source: '1x',
  url: 'https://1x.com/gallery/landscape',
  scene: '들판',
  basis: '페이지 분류 Landscape',
  window: 'sunset-20',
};

export const KNOWN_REFERENCES: ReferenceBrief[] = [rural, autumn, monarchs, walker, night, movingFigure, street, openLand];

export const WEEKLY_PICKS: WeeklyPick[] = [
  { ...rural, startsAt: '2026-10-11T00:00:00.000Z' },
  { ...autumn, startsAt: '2026-10-18T00:00:00.000Z' },
  { ...monarchs, startsAt: '2026-10-25T00:00:00.000Z' },
  { ...walker, startsAt: '2026-11-01T00:00:00.000Z' },
  { ...night, startsAt: '2026-11-08T00:00:00.000Z' },
  { ...movingFigure, startsAt: '2026-11-15T00:00:00.000Z' },
];

const byKey = new Map(KNOWN_REFERENCES.map((item) => [referenceKey(item.url), item]));

export function knownReference(url: string): ReferenceBrief | null {
  return byKey.get(referenceKey(url)) ?? null;
}

export function weeklyPick(now = new Date()): WeeklyPick {
  return pickForInstant(WEEKLY_PICKS, now);
}

const UNREAD_WINDOW: Record<SourceId, WindowKind> = {
  '1x': 'evening-golden',
  '1650': 'morning-golden',
  lensculture: 'evening-golden',
  worldpress: 'sunset-20',
  illume: 'sunrise-20',
  contentpool: 'sunrise-20',
};

export function describeAdded(url: string, source: SourceId): ReferenceBrief {
  const known = knownReference(url);
  if (known) return known;
  return {
    id: referenceKey(url),
    source,
    url,
    scene: null,
    basis: '페이지 글을 읽지 못함',
    window: UNREAD_WINDOW[source],
  };
}

export function windowForScene(scene: SceneChoice, fallback: WindowKind): WindowKind {
  if (scene === '밤') return 'evening-blue';
  if (scene === '바다') return 'sunset-20';
  if (scene === '오름') return 'morning-golden';
  if (scene === '거리' || scene === '사람') return 'morning-golden';
  return fallback;
}
