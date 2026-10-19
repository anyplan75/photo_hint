// 바로낚시의 인공지능브리핑과 같은 구글 제미나이 주소입니다.
// 암호는 빌드 환경 VITE_GEMINI_API_KEY 에만 둡니다. 이 파일에 적지 않습니다.
// 암호가 없으면 호출하지 않고, 자리 이름과 글 주소를 만들지 않습니다.

const MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type AiState = 'missing' | 'checking' | 'connected' | 'rejected' | 'empty';

export interface AiConnection {
  state: AiState;
  detail: string;
}

export interface AdvicePlace {
  id: string;
  name: string;
  distanceKm: number | null;
  score: number;
}

export interface AdvicePost {
  id: string;
  summary: string;
}

const MISSING: AiConnection = {
  state: 'missing',
  detail: '인공지능이 연결되지 않았습니다. 암호가 없습니다. 자리와 사진 글은 만들지 않습니다.',
};

function readKey(): string {
  return (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
}

/** 암호가 있는지만 봅니다. 값은 돌려주지 않습니다. */
export function hasGeminiKey(): boolean {
  return readKey().length > 0;
}

/** 호출 전에 화면에 적을 연결 상태입니다. */
export function aiAvailability(): AiConnection {
  if (!hasGeminiKey()) return MISSING;
  return { state: 'checking', detail: '인공지능 암호가 있습니다. 같은 주소로 연결을 확인하는 중입니다.' };
}

/**
 * 이미 있는 자리만 순서를 묻습니다.
 * 답에 없는 번호는 버립니다. 새 이름은 화면에 올리지 않습니다.
 */
export async function advisePlaces(places: AdvicePlace[], signal: AbortSignal): Promise<{ status: AiConnection; placeIds: string[] }> {
  const allowed = new Set(places.map((place) => place.id));
  const script = [
    '아래 자리만 지금 위치에서 가 볼 순서로 골라라.',
    'places 배열에는 아래 id만 넣어라.',
    ...places.slice(0, 12).map((place) => `- id: ${place.id} | 이름: ${place.name} | 거리km: ${place.distanceKm ?? '없음'} | 점수: ${place.score}`),
  ].join('\n');
  return ask(script, 'places', allowed, signal);
}

/**
 * 이미 받아 온 글 주소만 고르게 합니다.
 * 그림 주소와 새 글은 받지 않습니다.
 */
export async function advisePosts(posts: AdvicePost[], signal: AbortSignal): Promise<{ status: AiConnection; postIds: string[] }> {
  const allowed = new Set(posts.map((post) => post.id));
  const script = [
    '아래 공개 글만 지금 위치 주변 자리와 관련 있는 순서로 골라라.',
    'posts 배열에는 아래 id만 넣어라. 그림 주소는 넣지 마라.',
    ...posts.slice(0, 12).map((post) => `- id: ${post.id} | 문장: ${post.summary}`),
  ].join('\n');
  const result = await ask(script, 'posts', allowed, signal);
  return { status: result.status, postIds: result.placeIds };
}

async function ask(
  script: string,
  keyName: 'places' | 'posts',
  allowed: Set<string>,
  signal: AbortSignal,
): Promise<{ status: AiConnection; placeIds: string[] }> {
  const key = readKey();
  if (!key) return { status: MISSING, placeIds: [] };
  if (allowed.size === 0) return { status: emptyStatus(), placeIds: [] };
  let last = rejectedStatus('인공지능 주소에 연결하지 못했습니다. 추천은 만들지 않습니다.');
  for (const model of MODELS) {
    if (signal.aborted) return { status: MISSING, placeIds: [] };
    try {
      const text = await callModel(model, script, key, signal);
      const ids = readIds(text, keyName, allowed);
      if (ids.length === 0) return { status: emptyStatus(), placeIds: [] };
      return {
        status: { state: 'connected', detail: '인공지능이 연결되었습니다. 받아 둔 목록 안에서만 순서를 골랐습니다.' },
        placeIds: ids,
      };
    } catch (error) {
      if (signal.aborted) return { status: MISSING, placeIds: [] };
      last = error instanceof AdviceError ? error.status : last;
    }
  }
  return { status: last, placeIds: [] };
}

async function callModel(model: string, script: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const url = `${ENDPOINT}/${model}:generateContent`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [
                '너는 촬영 자리 안내자다.',
                '사용자가 준 id만 순서를 정한다.',
                '새 장소, 새 좌표, 새 점수, 새 글, 그림 주소를 만들지 마라.',
                '답은 JSON 하나만 써라. 키는 places 또는 posts 이다.',
              ].join(' '),
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: script }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    });
  } catch {
    throw new AdviceError(rejectedStatus('인공지능 주소에 연결하지 못했습니다. 추천은 만들지 않습니다.'));
  }
  if (!response.ok) throw new AdviceError(rejectedStatus('인공지능 연결이 거절되었습니다. 추천은 만들지 않습니다.'));
  const payload = (await response.json()) as unknown;
  const text = readCandidateText(payload).trim();
  if (!text) throw new AdviceError(emptyStatus());
  return text;
}

class AdviceError extends Error {
  status: AiConnection;
  constructor(status: AiConnection) {
    super(status.detail);
    this.status = status;
  }
}

function emptyStatus(): AiConnection {
  return { state: 'empty', detail: '인공지능이 빈 답을 보냈습니다. 계산된 점수 목록을 그대로 둡니다.' };
}

function rejectedStatus(detail: string): AiConnection {
  return { state: 'rejected', detail };
}

/** 모델 답에서 허용된 id만 꺼냅니다. 없는 id는 버립니다. */
export function readIds(text: string, keyName: 'places' | 'posts', allowed: Set<string>): string[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const list = parsed[keyName];
    if (!Array.isArray(list)) return [];
    const ids: string[] = [];
    for (const item of list) {
      if (typeof item !== 'string' || !allowed.has(item) || ids.includes(item)) continue;
      ids.push(item);
    }
    return ids;
  } catch {
    return [];
  }
}

function readCandidateText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';
  const first = candidates[0];
  if (!first || typeof first !== 'object') return '';
  const content = (first as { content?: unknown }).content;
  if (!content || typeof content !== 'object') return '';
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => (part && typeof part === 'object' ? (part as { text?: unknown }).text : ''))
    .filter((text): text is string => typeof text === 'string')
    .join('\n');
}
