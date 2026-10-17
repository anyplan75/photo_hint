import type { WindowKind } from './places';
import type { SourceId } from './sources';
import { referenceKey } from './sources';
import { pickForInstant, type DatedPick } from './week';

export interface ReferenceCopy {
  id: string;
  source: SourceId;
  url: string;
  scene: string;
  place: string;
  window: WindowKind;
  method: string;
  light: string;
  stand: string;
  wait: string;
  distance: string;
}

export interface WeeklyPick extends ReferenceCopy, DatedPick {
  startsAt: string;
}

const rural: ReferenceCopy = {
  id: 'rural-quiet',
  source: '1x',
  url: 'https://1x.com/magazine/permalink/9820',
  scene: '사람이 거의 없고, 들판이나 잔잔한 물이 멀리 깔린 장면입니다. 구조물은 화면 한쪽에 작게 둡니다.',
  place: '{region}에서 앞이 트인 들판 가장자리, 또는 바람이 잔잔한 물가.',
  window: 'evening-golden',
  method: '구조물에서 멀리 물러나 땅의 색이 따뜻해질 때까지 기다립니다.',
  light: '해가 낮게 떨어져 땅이 따뜻한 색으로 물들 때입니다. 하늘은 아직 밝게 남습니다.',
  stand: '물가나 구조물에서 스무 걸음 이상 물러납니다. 해는 화면 밖이나 구석에 둡니다.',
  wait: '사람이나 차가 프레임을 가로지르지 않는 몇 분을 기다립니다.',
  distance: '집이나 나무는 작게, 하늘과 땅이 화면의 대부분입니다.',
};

const autumn: ReferenceCopy = {
  id: 'autumn-leaves',
  source: '1x',
  url: 'https://1x.com/magazine/permalink/9852',
  scene: '잎이 노랗거나 붉게 바뀐 짧은 날, 나무 한 무리가 길을 따라 서는 장면입니다.',
  place: '{region}의 가로수 길, 또는 잎이 겹쳐 보이는 언덕.',
  window: 'morning-golden',
  method: '나무 옆에서 잎이 해를 받게 두고, 바람이 죽을 때까지 기다립니다.',
  light: '낮은 아침 해가 잎의 가장자리를 비출 때입니다. 한낮은 색이 평평해집니다.',
  stand: '줄기는 화면 가장자리에 붙이고, 길이 화면 안으로 들어오게 섭니다.',
  wait: '바람이 잠시 죽어 잎이 흔들리지 않을 때를 고릅니다.',
  distance: '나무에서 한 걸음 이상 떨어집니다. 잎만 가득 차면 길이 사라집니다.',
};

const monarchs: ReferenceCopy = {
  id: 'clustered-wings',
  source: 'worldpress',
  url: 'https://www.worldpressphoto.org/collection/photo-contest/2024/Jaime-Rojo/1',
  scene: '작은 생명들이 한데 모여 몸을 데우는 장면입니다. 한 마리를 쫓지 않고 무리가 머무는 자리를 담습니다.',
  place: '{region}에서 풀이 베이지 않은 공원 가장자리나 정원.',
  window: 'morning-golden',
  method: '풀과 같은 높이에서, 무리가 흩어지지 않을 거리를 유지합니다.',
  light: '아침의 낮은 빛이 무리의 가장자리를 데울 때입니다.',
  stand: '무릎을 낮추고, 풀숲과 눈이 같아지는 자리에서 봅니다.',
  wait: '다가가면 흩어집니다. 이미 모여 있는 자리를 찾습니다.',
  distance: '팔 길이보다 멀리 둡니다. 플래시는 쓰지 않습니다.',
};

const dryBed: ReferenceCopy = {
  id: 'dry-crossing',
  source: 'worldpress',
  url: 'https://www.worldpressphoto.org/collection/photo-contest/2024/Lalo-de-Almeida/1',
  scene: '평평하고 마른 바닥을 사람이 가로질러 걷는 장면입니다. 사람은 작고, 발밑의 금과 질감이 넓게 보입니다.',
  place: '{region}의 넓은 공터, 물이 빠진 갯벌, 또는 트인 강변.',
  window: 'sunset-20',
  method: '사람이 걸을 선의 옆에서, 해와 사람이 겹치지 않게 기다립니다.',
  light: '해가 지기 직전, 바닥이 낮게 빛나고 사람은 어두운 세로선이 됩니다.',
  stand: '걷는 방향의 옆, 바닥이 화면의 아래로 넓게 들어오는 자리입니다.',
  wait: '사람이 한가운데가 아니라 삼등분 선을 지날 때 누릅니다.',
  distance: '얼굴보다 걸음과 바닥이 보이게 멀리 섭니다.',
};

const night: ReferenceCopy = {
  id: 'one-lamp',
  source: '1x',
  url: 'https://1x.com/gallery/night',
  scene: '해가 진 뒤 하늘이 아직 남색인 동안, 불빛 하나가 자리를 잡는 장면입니다.',
  place: '{region}에서 등 하나가 다른 불빛과 떨어진 다리나 공터.',
  window: 'evening-blue',
  method: '등의 아래가 아니라 옆으로 떨어져, 남색 하늘이 위를 차지하게 섭니다.',
  light: '하늘이 검어지기 전, 남색이 남는 짧은 시간입니다. 등은 이미 켜져 있어야 합니다.',
  stand: '등에서 옆으로 떨어져 하늘이 화면의 위쪽을 차지하게 합니다.',
  wait: '다른 등이 프레임에 들어오지 않는 각도를 찾습니다.',
  distance: '등이 점이 될 때까지 물러납니다.',
};

const movingFigure: ReferenceCopy = {
  id: 'wide-motion',
  source: 'contentpool',
  url: 'https://www.redbullcontentpool.com/',
  scene: '사람이 넓은 장소 안에서 움직이는 장면입니다. 동작의 한순간보다, 그 사람이 설 자리를 먼저 봅니다.',
  place: '{region}의 트인 언덕, 해변, 또는 운동장이 내려다보이는 높은 자리.',
  window: 'sunrise-20',
  method: '사람이 움직일 방향의 옆에서, 배경이 단순해지는 높이에 섭니다.',
  light: '해가 막 떠 사람의 가장자리만 밝아질 때입니다.',
  stand: '움직일 선의 옆, 배경에 간판이나 전선이 없는 높이입니다.',
  wait: '점프나 회전의 꼭지에 닿기 직전을 기다립니다.',
  distance: '사람이 화면의 삼분의 일을 넘지 않게 멀리 둡니다.',
};

const street: ReferenceCopy = {
  id: 'street-edge',
  source: '1x',
  url: 'https://1x.com/gallery/street',
  scene: '길을 가는 사람이 빛과 그늘의 경계에 서는 장면입니다.',
  place: '{region}에서 아침 해가 길게 들어오는 골목.',
  window: 'morning-golden',
  method: '골목 입구에서 사람을 기다립니다. 얼굴의 밝은 면만 남기고 벽은 어둡게 둡니다.',
  light: '골목 안으로 해가 비스듬히 들어올 때입니다.',
  stand: '벽에서 한 발 떨어져, 사람이 빛과 그늘의 경계를 지나게 합니다.',
  wait: '사람이 경계에 닿을 때까지 셔터를 아끼지 말고, 그 한 걸음만 고릅니다.',
  distance: '사람과 벽 사이는 한 발 이상 띄웁니다.',
};

const openLand: ReferenceCopy = {
  id: 'open-land',
  source: '1x',
  url: 'https://1x.com/gallery/landscape',
  scene: '땅이 해 쪽으로 열린 장면입니다. 지평선은 화면 아래쪽에 둡니다.',
  place: '{region}에서 앞이 막히지 않는 높은 곳.',
  window: 'sunset-20',
  method: '지평선을 낮추고, 땅의 선이 해를 향해 가게 섭니다.',
  light: '해가 지평선 가까이 내려온 이십 분입니다.',
  stand: '앞을 가리는 난간보다 반 걸음 옆으로 비킵니다.',
  wait: '구름이 해를 반만 가릴 때를 기다립니다.',
  distance: '가까운 풀은 흐려도 됩니다. 먼 선이 선명하면 됩니다.',
};

export const KNOWN_REFERENCES: ReferenceCopy[] = [rural, autumn, monarchs, dryBed, night, movingFigure, street, openLand];

export const WEEKLY_PICKS: WeeklyPick[] = [
  { ...rural, startsAt: '2026-10-11T00:00:00.000Z' },
  { ...autumn, startsAt: '2026-10-18T00:00:00.000Z' },
  { ...monarchs, startsAt: '2026-10-25T00:00:00.000Z' },
  { ...dryBed, startsAt: '2026-11-01T00:00:00.000Z' },
  { ...night, startsAt: '2026-11-08T00:00:00.000Z' },
  { ...movingFigure, startsAt: '2026-11-15T00:00:00.000Z' },
];

const byKey = new Map(KNOWN_REFERENCES.map((item) => [referenceKey(item.url), item]));

export function knownReference(url: string): ReferenceCopy | null {
  return byKey.get(referenceKey(url)) ?? null;
}

export function weeklyPick(now = new Date()): WeeklyPick {
  return pickForInstant(WEEKLY_PICKS, now);
}

export function fillRegion(template: string, region: string): string {
  return template.replaceAll('{region}', region);
}

const GENERIC: Record<SourceId, Omit<ReferenceCopy, 'id' | 'source' | 'url'>> = {
  '1x': {
    scene: '직접 고른 1x 페이지입니다. 사진 파일은 가져오지 않고, 정돈된 한 장면을 이 지역에서 다시 시도합니다.',
    place: '{region}에서 앞이 단순하고 주제가 하나인 자리.',
    window: 'evening-golden',
    method: '주제에서 물러나 해가 낮아질 때까지 기다립니다.',
    light: '해가 낮게 떨어진 따뜻한 빛입니다.',
    stand: '주제가 화면 한쪽에 오게 섭니다.',
    wait: '지나는 사람이 빠질 때까지 기다립니다.',
    distance: '주제가 화면을 다 채우지 않게 멀리 둡니다.',
  },
  '1650': {
    scene: '직접 고른 1650Gallery 페이지입니다. 전시의 한 장면을 이 지역의 거리나 실내에서 다시 시도합니다.',
    place: '{region}의 거리, 또는 창이 있는 실내.',
    window: 'morning-golden',
    method: '주제를 가운데 두지 않고, 빛과 그늘이 나뉘는 자리에 둡니다.',
    light: '창이나 골목으로 들어오는 낮은 빛입니다.',
    stand: '주제의 옆에서, 배경이 단순해지는 각도를 고릅니다.',
    wait: '사람이 빛을 가로지르기 직전을 기다립니다.',
    distance: '한 팔 이상 떨어져 주위가 함께 보이게 합니다.',
  },
  lensculture: {
    scene: '직접 고른 LensCulture 페이지입니다. 이야기 한 장면의 거리와 빛을 이 지역에 옮깁니다.',
    place: '{region}에서 그 장면의 높이와 비슷한 길이나 언덕.',
    window: 'evening-golden',
    method: '설명 문구를 베끼지 않고, 서는 자리와 빛만 맞춥니다.',
    light: '해가 낮아 그림자가 길어질 때입니다.',
    stand: '주제와 같은 높이에서 봅니다.',
    wait: '장면이 조용해지는 몇 초를 고릅니다.',
    distance: '주제와 배경이 둘 다 읽히게 거리를 둡니다.',
  },
  worldpress: {
    scene: '직접 고른 World Press Photo 페이지입니다. 사람의 사연을 꾸미지 않고, 그 프레임의 거리와 빛만 이 지역에서 시도합니다.',
    place: '{region}에서 사람이 작게 보이는 트인 자리.',
    window: 'sunset-20',
    method: '사람을 크게 들이밀지 않고, 자리와 빛이 먼저 보이게 합니다.',
    light: '해가 지기 직전의 낮은 빛입니다.',
    stand: '사람이 걸을 선의 옆에 섭니다.',
    wait: '사람이 삼등분 선을 지날 때를 기다립니다.',
    distance: '얼굴보다 자리와 걸음이 보이게 멀리 둡니다.',
  },
  illume: {
    scene: '직접 고른 레드불 일루미네이트 페이지입니다. 사람이 넓은 장소 안에서 움직이는 장면을 이 지역에서 시도합니다.',
    place: '{region}의 트인 언덕, 해변, 또는 높은 자리.',
    window: 'sunrise-20',
    method: '동작보다 설 자리를 먼저 정하고, 사람의 가장자리가 밝아질 때를 기다립니다.',
    light: '막 떠오른 해가 가장자리만 비출 때입니다.',
    stand: '움직일 방향의 옆, 배경이 단순한 높이입니다.',
    wait: '동작의 꼭지에 닿기 직전입니다.',
    distance: '사람이 화면의 삼분의 일을 넘지 않게 합니다.',
  },
  contentpool: {
    scene: '직접 고른 레드불 콘텐츠 풀 페이지입니다. 사람이 넓은 장소 안에서 움직이는 장면을 이 지역에서 시도합니다.',
    place: '{region}의 트인 언덕, 해변, 또는 운동장이 보이는 높은 자리.',
    window: 'sunrise-20',
    method: '설 자리를 먼저 정하고, 사람의 가장자리가 밝아질 때를 기다립니다.',
    light: '막 떠오른 해가 가장자리만 비출 때입니다.',
    stand: '움직일 방향의 옆입니다.',
    wait: '동작의 꼭지에 닿기 직전입니다.',
    distance: '사람이 화면의 삼분의 일을 넘지 않게 합니다.',
  },
};

export function describeAdded(url: string, source: SourceId): ReferenceCopy {
  const known = knownReference(url);
  if (known) return known;
  return { id: referenceKey(url), source, url, ...GENERIC[source] };
}
