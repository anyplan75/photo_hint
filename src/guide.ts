import type { SunPlan } from './recommend';
import { cardinal, type RankedSpot, type SceneChoice } from './region-places';

export interface GuideBlock {
  heading: string;
  body: string;
}

export function shootingGuide(scene: SceneChoice, basis: string, spot: RankedSpot, plan: SunPlan): { lead: string; blocks: GuideBlock[] } {
  const unread = basis.includes('읽지 못');
  const place = spot.address ? `${spot.name}(${spot.address})` : spot.name;
  const lead = unread
    ? `이 안내는 그 사진 한 장을 읽은 것이 아닙니다. 고른 장면 유형 ‘${scene}’을 ${place}에서 준비하는 방법입니다.`
    : `${basis}에서 장면 유형을 ${scene}으로 골랐습니다. 아래는 그 유형을 ${place}에서 준비하는 방법입니다.`;
  const mismatch = spot.matchesScene ? '' : ` 이 자리는 ${scene} 유형 그 자체가 아니라 ${kindWord(spot)}입니다. 같은 유형을 이 주소에서 시도합니다.`;
  return {
    lead: lead + mismatch,
    blocks: [
      { heading: '준비', body: prepare(scene) },
      { heading: '렌즈', body: lensFor(scene, spot) },
      { heading: '장비', body: gearFor(scene, spot) },
      { heading: '도착', body: `${plan.arrive} 갈 곳은 ${place}입니다.` },
      { heading: '빛의 방향', body: light(plan, spot.name) },
      { heading: '서는 자리', body: stand(spot) },
      { heading: '거리', body: distance(scene, spot) },
      { heading: '기다리는 것', body: waitFor(scene) },
      { heading: '피할 조건', body: avoid(scene) },
    ],
  };
}

function kindWord(spot: RankedSpot): string {
  if (spot.kind === 'coast') return '해안';
  if (spot.kind === 'oreum') return '오름';
  if (spot.kind === 'harbor') return '항구';
  if (spot.kind === 'field') return '들판';
  if (spot.kind === 'cliff') return '절벽';
  return '거리';
}

function prepare(scene: SceneChoice): string {
  switch (scene) {
    case '들판':
      return '낮은 삼각대나 무릎 높이로 카메라를 고정할 것, 여분 배터리, 렌즈 헝겊을 챙깁니다. 하늘이 과하게 어두워지면 편광 필터는 빼 둡니다.';
    case '오름':
      return '바람막이, 미끄럼에 대비한 신발, 여분 옷, 다리를 짧게 세울 수 있는 삼각대를 챙깁니다. 능선에서는 손이 흔들리기 쉽습니다.';
    case '바다':
      return '렌즈 헝겊, 방수 주머니, 삼각대를 챙깁니다. 소금기가 묻으면 바로 닦을 천을 따로 둡니다.';
    case '거리':
      return '가벼운 몸, 길을 한 번에 담을 수 있는 화각, 여유 배터리. 플래시는 꺼 둡니다.';
    case '사람':
      return '짧은 셔터를 올릴 수 있는 감도, 여분 배터리. 플래시는 꺼 둡니다. 다가가 포즈를 요구하지 않습니다.';
    case '밤':
      return '삼각대, 수동 노출, 여분 배터리, 작은 손전등. 자동 플래시는 꺼 둡니다.';
    case '절벽':
      return '바람막이, 미끄럼 방지, 스트랩을 손목에 고정합니다. 절벽 끝에는 삼각대를 세우지 않습니다.';
    case '항구':
      return '렌즈 헝겊, 방수, 수평을 맞출 삼각대. 부두의 난간 높이를 가늠할 수 있게 낮은 시점도 준비합니다.';
  }
}

function lensFor(scene: SceneChoice, spot: RankedSpot): string {
  const place = spot.address ? `${spot.name}(${spot.address})` : spot.name;
  switch (scene) {
    case '오름':
      return `${place}에서는 주변보다 높아 하늘이 넓습니다. 16–35mm 광각을 가져갑니다.`;
    case '바다':
      return `${coastLine(spot)} 70–200mm 짧은 망원을 가져갑니다.`;
    case '들판':
      if (spot.kind === 'coast' || spot.kind === 'cliff' || spot.kind === 'harbor') {
        return `${place}에서는 들판 유형을 물가에서 시도합니다. 트인 바닥은 24mm 광각으로, 먼 물 선은 70–200mm 짧은 망원으로 받습니다.`;
      }
      return `${place}에서는 농지라 가까운 바닥과 먼 선이 함께 있습니다. 24–70mm를 가져갑니다.`;
    case '거리':
      return `${place}의 인도에서는 길과 벽을 한 번에 담도록 35mm를 가져갑니다.`;
    case '사람':
      return `${place}에서는 사람에게 바짝 다가가지 않도록 85mm를 가져갑니다.`;
    case '밤':
      return `${place}의 밤에는 남은 하늘을 남기도록 조리개가 밝은 24mm를 가져갑니다.`;
    case '절벽':
      return `${place}에서는 아래가 열린 절벽입니다. 16–35mm 광각을 가져가고, 먼 물 선에는 70–200mm를 더합니다.`;
    case '항구':
      return `${place}의 부두에서는 수평을 24–70mm로 맞추고, 떨어진 배는 70–200mm 짧은 망원으로 당깁니다.`;
  }
}

function coastLine(spot: RankedSpot): string {
  const place = spot.address ? `${spot.name}(${spot.address})` : spot.name;
  if (spot.seaward === undefined) return `${place}에서는 물 선이 멀리 있습니다.`;
  return `${place}의 바다는 ${cardinal(spot.seaward)}쪽이라 물 선이 멀리 있습니다.`;
}

function gearFor(scene: SceneChoice, spot: RankedSpot): string {
  const name = spot.name;
  switch (scene) {
    case '오름':
      return `${name} 준비에는 이미 바람이 적혀 있습니다. 가벼운 다리 대신 무게가 있는 삼각대를 챙기고, 밝은 하늘에는 편광 필터를 더합니다. 물이 없으므로 ND는 빼 둡니다.`;
    case '바다':
      return `${name}은 물과 밝은 하늘이 함께 있습니다. 편광 필터와 ND 필터를 챙기고, 소금기를 닦을 천을 따로 둡니다.`;
    case '들판':
      if (spot.kind === 'coast' || spot.kind === 'cliff' || spot.kind === 'harbor') {
        return `${name}은 들판 유형이지만 물가입니다. 무릎 높이 삼각대, 편광 필터, 물용 ND를 챙깁니다.`;
      }
      return `${name}은 농지라 물이 없습니다. 무릎 높이 삼각대와 밝은 하늘용 편광 필터를 챙기고, ND는 빼 둡니다.`;
    case '거리':
      return `${name}은 걷는 거리입니다. 삼각대와 필터는 빼 두고, 스트랩만 손목에 고정합니다.`;
    case '사람':
      return `${name}에서는 플래시와 삼각대, 필터를 빼 둡니다. 여분 배터리만 주머니에 둡니다.`;
    case '밤':
      return `${name}의 밤은 긴 노출입니다. 삼각대와 릴리즈, 작은 손전등을 챙기고, 편광 필터와 ND는 빼 둡니다.`;
    case '절벽':
      return `${name} 준비에는 이미 바람이 적혀 있습니다. 무게가 있는 삼각대는 난간 안쪽에만 세웁니다. 아래 물이 밝으면 편광 필터를 더합니다.`;
    case '항구':
      return `${name}은 부두의 물입니다. 수평용 삼각대, 편광 필터, ND, 소금기를 닦을 천을 챙깁니다.`;
  }
}

function light(plan: SunPlan, name: string): string {
  if (plan.azimuth === null || plan.altitude === null) {
    return `${plan.summary}. ${name}을 해 쪽에 두고, 빛은 주제의 옆이나 뒤에서 오게 섭니다.`;
  }
  const height = plan.altitude >= 0 ? `고도 ${plan.altitude}°로 아직 지평선 위입니다.` : `고도 ${plan.altitude}°로 지평선 아래입니다. 남은 하늘빛만 씁니다.`;
  return `${plan.summary}. 빛은 ${cardinal(plan.azimuth)}쪽(방위 ${plan.azimuth}°)에서 옵니다. ${height} ${name}을 그 방향에 두고, 빛이 주제의 옆이나 뒤를 스치게 섭니다.`;
}

function stand(spot: RankedSpot): string {
  const where = spot.address ? `${spot.address}의 ${spot.name}` : spot.name;
  switch (spot.kind) {
    case 'field':
      return `${where} 가장자리에 섭니다. 작물이나 울타리가 해를 가리지 않는 쪽에서, 땅이 화면 아래를 차지하게 합니다.`;
    case 'oreum':
      return `${where}에서는 정상 바로 아래, 하늘이 트인 쪽에 섭니다. 난간이 렌즈를 가리면 반 걸음 옆으로 비킵니다.`;
    case 'coast':
      return `${where}에서 물가보다 한두 걸음 위, 파도가 닿지 않는 선에 섭니다.`;
    case 'cliff':
      return `${where}에서는 절벽 끝보다 뒤에서 섭니다. 발밑이 열리되 난간 밖으로 기대지 않습니다.`;
    case 'harbor':
      return `${where}의 부두 가장자리에 섭니다. 크레인이나 창고 그늘에서 한 걸음 나와 수평선이 보이게 합니다.`;
    case 'street':
      return `${where}의 인도 끝에 섭니다. 벽에서 한 발 떨어져 길이 화면 안으로 들어오게 합니다.`;
  }
}

function distance(scene: SceneChoice, spot: RankedSpot): string {
  if (scene === '사람' || scene === '거리') {
    return `${spot.name}에서 사람과 벽, 또는 사람과 길 사이는 한 발 이상 띄웁니다. 얼굴보다 걸음과 자리가 같이 보이게 물러섭니다.`;
  }
  if (scene === '밤') {
    return '불빛이 점이 될 때까지 물러섭니다. 하늘이 화면의 위를 차지하게 가깝게 들이밀지 않습니다.';
  }
  if (spot.kind === 'oreum' || scene === '오름') {
    return '오름 전체와 하늘이 같이 들어오게 능선에서 내려와 거리를 둡니다. 풀만 가득 차면 자리가 사라집니다.';
  }
  return `${spot.name}에서는 가까운 바닥이 흐려도 됩니다. 먼 선이 화면 안에 남을 만큼 물러섭니다.`;
}

function waitFor(scene: SceneChoice): string {
  switch (scene) {
    case '들판':
      return '사람이나 차가 프레임을 비우고, 바람이 잠시 죽어 풀이 흔들리지 않을 때를 기다립니다.';
    case '오름':
      return '구름이 해를 반만 가리고, 능선 위의 사람이 지나간 뒤를 기다립니다.';
    case '바다':
      return '파도가 빠진 뒤, 수평선 위에 배나 사람이 겹치지 않는 호흡을 기다립니다.';
    case '거리':
      return '사람이 빛과 그늘의 경계를 한 걸음 지나는 순간을 기다립니다. 그 전후는 흘려보냅니다.';
    case '사람':
      return '사람이 화면 한가운데가 아니라 삼등분 선을 지날 때를 기다립니다. 멈추라고 하지 않습니다.';
    case '밤':
      return '하늘이 검어지기 전, 남색이 남아 있는 동안만 기다립니다. 등이 이미 켜져 있어야 합니다.';
    case '절벽':
      return '바람이 잠시 죽고, 아래 바다에 하얀 파도가 한 줄 지나간 뒤를 기다립니다.';
    case '항구':
      return '배가 부두에 붙거나 빠져 수평선이 열리는 틈을 기다립니다. 크레인 불빛이 렌즈에 들어오면 각도를 바꿉니다.';
  }
}

function avoid(scene: SceneChoice): string {
  switch (scene) {
    case '들판':
      return '한낮의 머리 위 빛, 땅을 하얗게 날리는 노출, 울타리 바로 앞에서 지평선이 사라지는 자리는 피합니다.';
    case '오름':
      return '안개로 앞이 안 보일 때, 정상 난간에 카메라가 가릴 때, 강한 바람에 삼각대가 흔들릴 때는 피합니다.';
    case '바다':
      return '밀물로 설 자리가 사라질 때, 렌즈에 소금이 묻은 채 찍을 때, 한낮의 평평한 빛은 피합니다.';
    case '거리':
      return '정오의 짧은 그림자, 간판 반사가 렌즈를 채울 때, 차도에 내려서는 자리는 피합니다.';
    case '사람':
      return '플래시, 바짝 다가가 얼굴을 채우는 것, 지나가다 멈춘 사람을 붙잡는 것은 피합니다.';
    case '밤':
      return '하늘이 완전히 검어진 뒤, 자동 플래시, 삼각대 없이 긴 노출은 피합니다.';
    case '절벽':
      return '난간 밖, 젖은 바위 끝, 바람이 몸을 미는 자리는 피합니다.';
    case '항구':
      return '작업 중인 크레인 아래, 차량이 지나는 부두 한가운데, 역광으로 배가 실루엣만 되는 노출은 피합니다.';
  }
}
