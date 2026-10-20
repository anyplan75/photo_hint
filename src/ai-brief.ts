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
  return (import.meta.env?.VITE_GEMINI_API_KEY ?? '').trim();
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
 * 이미 있는 자리만 지금 위치에서 가 볼 순서로 묻습니다.
 * 답에 없는 이름은 버립니다. 새 자리는 만들지 않습니다.
 * 본문이 비면 짧은 질문으로 한 번만 다시 묻습니다.
 */
export async function advisePlaces(places: AdvicePlace[], signal: AbortSignal): Promise<{ status: AiConnection; placeIds: string[] }> {
  const listed = places.slice(0, 12);
  const script = [
    '지금 위치 주변의 아래 자리만 가 볼 순서로 정렬하라.',
    'JSON 하나만. 키는 order. 값은 아래 이름만.',
    ...listed.map((place) => place.name),
  ].join('\n');
  const shorter = ['이름만 순서 JSON. 키는 order.', ...listed.map((place) => place.name)].join('\n');
  return ask(script, shorter, listed.map((place) => ({ id: place.id, name: place.name })), signal);
}

/**
 * 이미 받아 온 글 주소만 고르게 합니다.
 * 그림 주소와 새 글은 받지 않습니다.
 */
export async function advisePosts(posts: AdvicePost[], signal: AbortSignal): Promise<{ status: AiConnection; postIds: string[] }> {
  const script = [
    '아래 공개 글만 지금 위치 주변 자리와 관련 있는 순서로 골라라.',
    'posts 배열에는 아래 id만 넣어라. 그림 주소는 넣지 마라.',
    ...posts.slice(0, 12).map((post) => `- id: ${post.id} | 문장: ${post.summary}`),
  ].join('\n');
  const listed = posts.slice(0, 12).map((post) => ({ id: post.id, name: post.id }));
  const result = await ask(script, `글 주소만 순서 JSON. 키는 order.\n${listed.map((post) => post.id).join('\n')}`, listed, signal);
  return { status: result.status, postIds: result.placeIds };
}

async function ask(
  script: string,
  shorter: string,
  places: { id: string; name: string }[],
  signal: AbortSignal,
): Promise<{ status: AiConnection; placeIds: string[] }> {
  const key = readKey();
  if (!key) return { status: MISSING, placeIds: [] };
  if (places.length === 0) return { status: emptyAfterRetry(), placeIds: [] };
  const first = await generate(script, key, signal);
  if (signal.aborted) return { status: MISSING, placeIds: [] };
  let text = first.text;
  let failure = first.failure;
  if (!text.trim()) {
    const second = await generate(shorter, key, signal);
    if (signal.aborted) return { status: MISSING, placeIds: [] };
    text = second.text;
    failure = second.failure ?? failure;
  }
  if (!text.trim()) return { status: failure ?? emptyAfterRetry(), placeIds: [] };
  const ids = readOrder(text, places);
  if (ids.length === 0) {
    return {
      status: {
        state: 'empty',
        detail: '인공지능 답의 이름이 지금 목록과 맞지 않습니다. 새 자리는 만들지 않고 계산된 점수 목록을 그대로 둡니다.',
      },
      placeIds: [],
    };
  }
  return {
    status: { state: 'connected', detail: '인공지능이 연결되었습니다. 받아 둔 목록 안에서만 가 볼 순서를 골랐습니다.' },
    placeIds: ids,
  };
}

async function generate(script: string, key: string, signal: AbortSignal): Promise<{ text: string; failure: AiConnection | null }> {
  let failure: AiConnection | null = null;
  for (const model of MODELS) {
    if (signal.aborted) return { text: '', failure: MISSING };
    try {
      const text = await callModel(model, script, key, signal);
      if (text.trim()) return { text, failure: null };
      failure = emptyAfterRetry();
    } catch (error) {
      if (signal.aborted) return { text: '', failure: MISSING };
      failure = error instanceof AdviceError ? error.status : rejectedStatus('인공지능 주소에 연결하지 못했습니다. 추천은 만들지 않습니다.');
    }
  }
  return { text: '', failure };
}

async function callModel(model: string, script: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const rich = await postModel(model, script, apiKey, signal, true);
  if (rich.kind === 'text') return rich.text;
  if (signal.aborted) return '';
  const plain = await postModel(model, script, apiKey, signal, false);
  if (plain.kind === 'text') return plain.text;
  if (plain.kind === 'empty' || rich.kind === 'empty') return '';
  throw new AdviceError(plain.kind === 'fail' ? plain.status : rich.status);
}

async function postModel(
  model: string,
  script: string,
  apiKey: string,
  signal: AbortSignal,
  jsonMode: boolean,
): Promise<{ kind: 'text'; text: string } | { kind: 'empty' } | { kind: 'fail'; status: AiConnection }> {
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
              text: '너는 촬영 자리 안내자다. 사용자가 준 이름만 순서를 정한다. 새 장소와 그림 주소는 만들지 마라. JSON만 써라. 키는 order.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: script }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          ...(jsonMode
            ? {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 0 },
                responseSchema: {
                  type: 'OBJECT',
                  properties: { order: { type: 'ARRAY', items: { type: 'STRING' } } },
                  required: ['order'],
                },
              }
            : {}),
        },
      }),
    });
  } catch {
    return { kind: 'fail', status: rejectedStatus('인공지능 주소에 연결하지 못했습니다. 추천은 만들지 않습니다.') };
  }
  if (!response.ok) {
    return {
      kind: 'fail',
      status: rejectedStatus(
        response.status === 400
          ? '인공지능이 질문 형식을 거절했습니다. 추천은 만들지 않습니다.'
          : '인공지능 연결이 거절되었습니다. 추천은 만들지 않습니다.',
      ),
    };
  }
  const payload = (await response.json()) as unknown;
  const text = readCandidateText(payload).trim();
  return text ? { kind: 'text', text } : { kind: 'empty' };
}

class AdviceError extends Error {
  status: AiConnection;
  constructor(status: AiConnection) {
    super(status.detail);
    this.status = status;
  }
}

function emptyAfterRetry(): AiConnection {
  return {
    state: 'empty',
    detail: '인공지능에 두 번 물었지만 답 본문이 비었습니다. 계산된 점수 목록을 그대로 둡니다.',
  };
}

function rejectedStatus(detail: string): AiConnection {
  return { state: 'rejected', detail };
}

/** 모델 답에서 허용된 id만 꺼냅니다. 없는 id는 버립니다. */
export function readIds(text: string, keyName: 'places' | 'posts', allowed: Set<string>): string[] {
  return readOrder(
    text,
    [...allowed].map((id) => ({ id, name: id })),
  ).filter((id) => {
    const list = extractList(text, keyName);
    return list.includes(id);
  });
}

/** 답의 order, places, posts 안에서 이미 있는 자리만 순서로 고릅니다. */
export function readOrder(text: string, places: { id: string; name: string }[]): string[] {
  const byId = new Map(places.map((place) => [place.id, place.id]));
  const byName = new Map(places.map((place) => [norm(place.name), place.id]));
  const raw = extractList(text, 'order').concat(extractList(text, 'places'), extractList(text, 'posts'));
  const ids: string[] = [];
  for (const item of raw) {
    const id = byId.get(item) ?? byName.get(norm(item));
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function extractList(text: string, keyName: string): string[] {
  const match = text.match(/\{[\s\S]*\}/);
  const source = match?.[0] ?? text;
  try {
    const parsed = JSON.parse(source) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
    if (!parsed || typeof parsed !== 'object') return [];
    const list = (parsed as Record<string, unknown>)[keyName];
    if (!Array.isArray(list)) return [];
    return list.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
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
  const visible = parts.flatMap((part) => {
    if (!part || typeof part !== 'object') return [];
    const row = part as { text?: unknown; thought?: unknown };
    if (row.thought === true) return [];
    return typeof row.text === 'string' ? [row.text] : [];
  });
  return visible.join('\n');
}
