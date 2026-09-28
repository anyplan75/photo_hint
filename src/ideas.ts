const COMPASS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'] as const;

export function compassName(azimuth: number): string {
  const index = Math.round(normalize(azimuth) / 45) % 8;
  return COMPASS[index];
}

export function lightIdea(input: {
  body: 'sun' | 'moon';
  azimuth: number;
  altitude: number;
  subjectName: string;
  subjectAzimuth: number;
}): string {
  const name = input.body === 'sun' ? '해' : '달';
  const gap = smallestAngle(input.azimuth, input.subjectAzimuth);
  const azimuth = showAzimuth(input.azimuth);
  const altitude = input.altitude.toFixed(1);
  const subject = showAzimuth(input.subjectAzimuth);
  const head = `${topic(name)} 방위 ${azimuth}°(${compassName(input.azimuth)}), 고도 ${altitude}°입니다. ${topic(input.subjectName)} 방위 ${subject}°입니다.`;
  const rounded = Math.round(gap);

  if (input.altitude < -0.8) {
    if (gap <= 35) {
      return `${head} ${topic(name)} 졌지만 ${input.subjectName} 방향의 하늘이 아직 밝습니다. 윤곽은 이 남색이 남는 동안만 삽니다.`;
    }
    return `${head} ${subjectParticle(name)} 지평선 아래라 직사광은 없습니다. 남는 것은 하늘 밝기입니다.`;
  }
  if (gap <= 18 && input.altitude <= 15) {
    return `${head} 방향 차이가 ${rounded}°라 ${subjectParticle(name)} ${input.subjectName} 뒤에 가깝습니다. 낮은 역광으로 실루엣과 정렬이 됩니다.`;
  }
  if (gap <= 18) {
    return `${head} 방향 차이는 ${rounded}°로 가깝지만, 고도가 높아 납작한 역광은 아닙니다.`;
  }
  if (gap <= 45) {
    return `${head} 방향 차이가 ${rounded}°입니다. 같은 낮은 하늘에 있지만 피사체 한가운데에서는 비껴 있습니다.`;
  }
  if (gap >= 70 && gap <= 110) {
    return `${head} 방향 차이가 ${rounded}°라 빛이 옆에서 들어옵니다.`;
  }
  if (gap >= 150) {
    return `${head} 방향 차이가 ${rounded}°라 ${subjectParticle(name)} 등 뒤에 있습니다. 피사체는 앞빛이 됩니다.`;
  }
  return `${head} 방향 차이는 ${rounded}°입니다. 빛은 비스듬히 들어옵니다.`;
}

export function smallestAngle(a: number, b: number): number {
  const diff = Math.abs(normalize(a) - normalize(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function showAzimuth(degrees: number): number {
  return Math.round(normalize(degrees)) % 360;
}

function batchim(word: string): boolean {
  const last = [...word.normalize('NFC')].at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function topic(word: string): string {
  return `${word}${batchim(word) ? '은' : '는'}`;
}

function subjectParticle(word: string): string {
  return `${word}${batchim(word) ? '이' : '가'}`;
}
