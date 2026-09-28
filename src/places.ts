export type Composition = 'silhouette' | 'reflection' | 'frame' | 'alignment';

export type WindowKind =
  | 'sunset-20'
  | 'sunrise-20'
  | 'evening-golden'
  | 'morning-golden'
  | 'evening-blue'
  | 'morning-blue'
  | 'moon-40';

export interface SubjectPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface SubjectBearing {
  name: string;
  azimuth: number;
}

export interface Shot {
  id: string;
  title: string;
  summary: string;
  window: WindowKind;
  compositions: Composition[];
  subject: SubjectPoint | SubjectBearing;
  frame: {
    stand: string;
    how: string;
  };
}

export interface Place {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  elevationM: number;
  standLabel: string;
  shots: Shot[];
}

export const COMPOSITION_LABEL: Record<Composition, string> = {
  silhouette: '실루엣',
  reflection: '반영',
  frame: '프레임 안의 프레임',
  alignment: '정렬',
};

export const PLACES: Place[] = [
  {
    id: 'namsan',
    name: '남산서울타워',
    area: '서울 용산구',
    lat: 37.55117,
    lng: 126.9915,
    elevationM: 190,
    standLabel: '남산 정상 동쪽 산책로',
    shots: [
      {
        id: 'namsan-silhouette',
        title: '타워가 검게 서는 20분',
        summary: '해가 지기 직전 20분만 타워 뒤 하늘이 낮고 따뜻합니다.',
        window: 'sunset-20',
        compositions: ['silhouette', 'alignment'],
        subject: { name: '남산서울타워', lat: 37.5511694, lng: 126.9882266 },
        frame: {
          stand: '남산 정상 동쪽 산책로. 타워를 서쪽 하늘에 두는 자리.',
          how: '타워를 화면 왼쪽 1/3에 세웁니다. 하늘은 위 2/3를 비우고, 사람은 타워 앞에 겹치지 않게 둡니다.',
        },
      },
      {
        id: 'namsan-blue',
        title: '남색 하늘에 남는 타워',
        summary: '해가 진 뒤 하늘이 남색인 동안만 타워 윤곽이 또렷합니다.',
        window: 'evening-blue',
        compositions: ['silhouette'],
        subject: { name: '남산서울타워', lat: 37.5511694, lng: 126.9882266 },
        frame: {
          stand: '같은 동쪽 산책로.',
          how: '타워를 화면 중앙으로 옮깁니다. 주변 가로등은 가장자리에서 잘라 내고, 타워 뒤에는 하늘만 남깁니다.',
        },
      },
    ],
  },
  {
    id: 'gwanghwamun',
    name: '광화문',
    area: '서울 종로구',
    lat: 37.57515,
    lng: 126.97689,
    elevationM: 40,
    standLabel: '광화문 월대 남쪽',
    shots: [
      {
        id: 'gwanghwamun-frame',
        title: '문 안에 문이 겹치는 블루아워',
        summary: '하늘이 남색으로 남는 동안에만 문루와 개구부의 밝기 차이가 살아납니다.',
        window: 'evening-blue',
        compositions: ['frame'],
        subject: { name: '광화문', lat: 37.575937, lng: 126.976889 },
        frame: {
          stand: '광화문 월대 남쪽, 문이 화면을 가득 채우는 거리.',
          how: '광화문 개구부를 바깥 프레임으로 삼고, 그 한가운데에 안쪽 문이 들어오게 맞춥니다. 문을 기울이지 않습니다.',
        },
      },
    ],
  },
  {
    id: 'seokchon',
    name: '석촌호수 동호',
    area: '서울 송파구',
    lat: 37.5089,
    lng: 127.1038,
    elevationM: 15,
    standLabel: '동호 남쪽 수변',
    shots: [
      {
        id: 'seokchon-reflection',
        title: '호수에 잠긴 타워',
        summary: '저녁 골든아워에만 타워 유리와 수면이 같은 따뜻한 색이 됩니다.',
        window: 'evening-golden',
        compositions: ['reflection'],
        subject: { name: '롯데월드타워', lat: 37.5124641, lng: 127.102543 },
        frame: {
          stand: '석촌호수 동호 남쪽 수변 데크.',
          how: '수면이 화면 아래 절반이 되게 카메라를 낮춥니다. 타워는 위 절반 중앙에 두고, 반영이 아래로 이어지게 수평을 맞춥니다.',
        },
      },
      {
        id: 'seokchon-moon',
        title: '낮게 뜬 달과 타워',
        summary: '달이 뜬 직후 40분만 달이 수면 가까이에 있습니다.',
        window: 'moon-40',
        compositions: ['reflection', 'alignment'],
        subject: { name: '롯데월드타워', lat: 37.5124641, lng: 127.102543 },
        frame: {
          stand: '같은 동호 남쪽 데크. 달이 타워 쪽에 오면 그 방향으로 발을 옮깁니다.',
          how: '달과 타워를 한 세로선에 올려 봅니다. 수면에 둘의 반영이 들어가면 그 높이에서 고정합니다.',
        },
      },
    ],
  },
  {
    id: 'haeundae',
    name: '해운대해수욕장',
    area: '부산 해운대구',
    lat: 35.16083,
    lng: 129.16389,
    elevationM: 2,
    standLabel: '백사장 중앙',
    shots: [
      {
        id: 'haeundae-sunrise',
        title: '수평선에 걸린 해',
        summary: '해가 뜬 뒤 20분만 해가 바다 위에 낮게 붙어 있습니다.',
        window: 'sunrise-20',
        compositions: ['alignment', 'silhouette'],
        subject: { name: '동쪽 바다', azimuth: 95 },
        frame: {
          stand: '해운대 백사장 중앙, 물이 발목에 닿기 직전. 동쪽 바다를 봅니다.',
          how: '수평선을 화면 아래 1/3에 두고 해를 그 선 위에 올립니다. 앞쪽 사람은 해를 가리지 않게 왼쪽 끝에 실루엣으로 둡니다.',
        },
      },
    ],
  },
];

export function findShot(shotId: string): { place: Place; shot: Shot } | null {
  for (const place of PLACES) {
    const shot = place.shots.find((item) => item.id === shotId);
    if (shot) return { place, shot };
  }
  return null;
}

export function bearingDegrees(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function subjectAzimuth(place: Place, shot: Shot): number {
  if ('azimuth' in shot.subject) return normalize(shot.subject.azimuth);
  const raw = bearingDegrees(place.lat, place.lng, shot.subject.lat, shot.subject.lng);
  return normalize(raw);
}

export function lightBody(kind: WindowKind): 'sun' | 'moon' {
  return kind === 'moon-40' ? 'moon' : 'sun';
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
