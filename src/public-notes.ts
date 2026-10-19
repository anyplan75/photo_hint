import { distanceMeters } from './geo';

// 로그인 없이 열리는 사진 글만 가져옵니다.
// 열쇠가 필요한 곳, 비공개 글, 쪽지는 부르지 않습니다.
// 주소가 막히면 다른 길로 돌아가지 않습니다.
// 글에 없는 문장과 좌표는 만들지 않습니다. 그림 주소는 화면에 걸지 않습니다.

export interface PublicNote {
  id: string;
  sourceKey: 'mastodon' | 'misskey' | 'bluesky';
  sourceName: string;
  pageURL: string;
  writtenAt: number;
  hasClock: boolean;
  summary: string;
}

export interface PublicSourceLine {
  name: string;
  detail: string;
  answered: boolean;
}

export interface PublicNotesBundle {
  notes: PublicNote[];
  lines: PublicSourceLine[];
  fetchedAt: number | null;
}

export interface PublicNotesQuery {
  placeName: string;
  center: { lat: number; lng: number };
  radiusKm: number;
}

const QUIET_MS = 120_000;
const PAGE = 40;
const PER_SOURCE = 8;
const TOTAL = 24;
const SKIP_NAMES = new Set(['', '내 주변', '선택한 지역', '저장한 지역']);
const PHOTO_KO = ['사진', '촬영', '출사', '카메라', '렌즈', '스냅'];
const PHOTO_LATIN = /\b(photographs?|photography|photos?|cameras?|lenses|murals?|artworks?)\b/i;
const BLOCKED = new Set([401, 403, 429, 451]);

interface CacheEntry {
  key: string;
  at: number;
  bundle: PublicNotesBundle;
}

let cache: CacheEntry | null = null;
let inflight: { key: string; promise: Promise<PublicNotesBundle> } | null = null;

export function peekPublicNotes(query: PublicNotesQuery): PublicNotesBundle | null {
  const key = cacheKey(query);
  if (!key || !cache || cache.key !== key) return null;
  if (Date.now() - cache.at >= QUIET_MS) return null;
  return cache.bundle;
}

export function loadPublicNotesCached(query: PublicNotesQuery): Promise<PublicNotesBundle> {
  const key = cacheKey(query);
  if (!key) return Promise.resolve(emptyBundle());
  const fresh = peekPublicNotes(query);
  if (fresh) return Promise.resolve(fresh);
  if (inflight?.key === key) return inflight.promise;
  const promise = loadPublicNotes(query)
    .then((bundle) => {
      if (bundle.lines.some((line) => line.answered)) {
        cache = { key, at: Date.now(), bundle: { ...bundle, fetchedAt: Date.now() } };
      }
      if (inflight?.key === key) inflight = null;
      return cache?.key === key ? cache.bundle : { ...bundle, fetchedAt: bundle.fetchedAt ?? Date.now() };
    })
    .catch(() => {
      if (inflight?.key === key) inflight = null;
      return {
        notes: [],
        lines: [{ name: '공개 사진글', detail: '연결하지 못했습니다.', answered: false }],
        fetchedAt: Date.now(),
      };
    });
  inflight = { key, promise };
  return promise;
}

export async function loadPublicNotes(query: PublicNotesQuery): Promise<PublicNotesBundle> {
  const tags = placeTags(query.placeName);
  if (tags.length === 0) return emptyBundle();
  const needles = placeNeedles(query.placeName);
  const [mastodon, misskey, bluesky] = await Promise.all([
    loadMastodon(tags, needles, query),
    loadMisskey(tags, needles, query),
    loadBluesky(tags, needles, query),
  ]);
  const parts = [mastodon, misskey, bluesky];
  const notes = tidy(parts.flatMap((part) => part.notes));
  const lines = parts.map((part) => recount(part.line, part.key, notes));
  return { notes, lines, fetchedAt: null };
}

function emptyBundle(): PublicNotesBundle {
  return { notes: [], lines: [], fetchedAt: null };
}

function cacheKey(query: PublicNotesQuery): string {
  const tags = placeTags(query.placeName);
  if (tags.length === 0) return '';
  return `${tags.join('|')}|${Math.round(query.radiusKm)}`;
}

export function placeTags(placeName: string): string[] {
  const compact = compactPlace(placeName);
  if (!compact || SKIP_NAMES.has(placeName.trim()) || SKIP_NAMES.has(compact)) return [];
  const tags = [compact];
  if (compact === '제주' || placeName.includes('제주')) tags.push('jeju');
  return unique(tags);
}

function placeNeedles(placeName: string): string[] {
  return placeTags(placeName);
}

function compactPlace(placeName: string): string {
  let text = placeName.trim();
  const longSuffix = ['특별자치도', '특별자치시', '특별시', '광역시', '자치시', '자치도'];
  for (const suffix of longSuffix) {
    if (text.endsWith(suffix) && text.length > suffix.length) text = text.slice(0, -suffix.length);
  }
  if (text.length > 2 && /[시군구도]$/.test(text)) text = text.slice(0, -1);
  return text.trim();
}

interface SourcePart {
  key: PublicNote['sourceKey'];
  notes: PublicNote[];
  line: PublicSourceLine;
}

async function loadMastodon(tags: string[], needles: string[], query: PublicNotesQuery): Promise<SourcePart> {
  const name = '마스토돈 공개 글';
  return loadTagged(name, 'mastodon', tags, async (tag) => {
    const url = `https://mastodon.social/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${PAGE}`;
    const page = await fetchPage(url);
    if (!page.ok) return page;
    const rows = parseArray(page.text);
    const notes: PublicNote[] = [];
    for (const row of rows) {
      const note = mastodonNote(row, needles, query);
      if (note) notes.push(note);
    }
    return { ...page, notes };
  });
}

function mastodonNote(row: Record<string, unknown>, needles: string[], query: PublicNotesQuery): PublicNote | null {
  if (asString(row.visibility) !== 'public') return null;
  const text = plain(asString(row.content));
  const when = parseWhen(asString(row.created_at));
  const pageURL = httpsUrl(asString(row.url));
  if (!when || !pageURL || !keepNote(text, readCoords(row), needles, query)) return null;
  const host = new URL(pageURL).host || '마스토돈';
  return {
    id: pageURL,
    sourceKey: 'mastodon',
    sourceName: `마스토돈 · ${host}`,
    pageURL,
    writtenAt: when.at,
    hasClock: when.hasClock,
    summary: front(text, 180),
  };
}

async function loadMisskey(tags: string[], needles: string[], query: PublicNotesQuery): Promise<SourcePart> {
  const name = '미스키 공개 글';
  return loadTagged(name, 'misskey', tags, async (tag) => {
    const page = await fetchPage('https://misskey.io/api/notes/search-by-tag', {
      method: 'POST',
      body: JSON.stringify({ tag, limit: PAGE }),
      contentType: 'application/json',
    });
    if (!page.ok) return page;
    const notes: PublicNote[] = [];
    for (const row of parseArray(page.text)) {
      const note = misskeyNote(row, needles, query);
      if (note) notes.push(note);
    }
    return { ...page, notes };
  });
}

function misskeyNote(row: Record<string, unknown>, needles: string[], query: PublicNotesQuery): PublicNote | null {
  if (asString(row.visibility) !== 'public') return null;
  const text = plain(asString(row.text));
  const when = parseWhen(asString(row.createdAt));
  const id = asString(row.id);
  if (!/^[A-Za-z0-9]+$/.test(id)) return null;
  const pageURL = `https://misskey.io/notes/${id}`;
  if (!when || !keepNote(text, readCoords(row), needles, query)) return null;
  return {
    id: pageURL,
    sourceKey: 'misskey',
    sourceName: '미스키',
    pageURL,
    writtenAt: when.at,
    hasClock: when.hasClock,
    summary: front(text, 180),
  };
}

async function loadBluesky(tags: string[], needles: string[], query: PublicNotesQuery): Promise<SourcePart> {
  const name = '블루스카이 공개 검색';
  const key: PublicNote['sourceKey'] = 'bluesky';
  const search = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts');
  search.searchParams.set('q', blueskyQuery(tags));
  search.searchParams.set('limit', '20');
  const page = await fetchPage(search.toString());
  if (page.blocked) {
    return { key, notes: [], line: { name, detail: '응답이 막혀 있습니다. 우회하지 않습니다.', answered: true } };
  }
  if (!page.ok) {
    const detail = page.status === 0 ? '연결하지 못했습니다.' : '공개 검색을 읽지 못했습니다.';
    return { key, notes: [], line: { name, detail, answered: page.status !== 0 } };
  }
  const posts = asArray(asRecord(parseJson(page.text))?.posts);
  const notes: PublicNote[] = [];
  for (const item of posts) {
    const row = asRecord(item);
    if (!row) continue;
    const note = blueskyNote(row, needles, query);
    if (note) notes.push(note);
  }
  const kept = tidy(notes).slice(0, PER_SOURCE);
  return { key, notes: kept, line: countLine(name, kept.length, page) };
}

function blueskyNote(post: Record<string, unknown>, needles: string[], query: PublicNotesQuery): PublicNote | null {
  const record = asRecord(post.record) ?? {};
  const text = plain(asString(record.text));
  const when = parseWhen(asString(record.createdAt));
  const author = asRecord(post.author) ?? {};
  const handle = asString(author.handle);
  if (!/^[A-Za-z0-9.-]+$/.test(handle)) return null;
  const uri = asString(post.uri);
  const rkey = uri.split('/').pop() ?? '';
  if (!/^[A-Za-z0-9._~:-]+$/.test(rkey)) return null;
  const pageURL = `https://bsky.app/profile/${handle}/post/${rkey}`;
  if (!when || !keepNote(text, readCoords(post) ?? readCoords(record), needles, query)) return null;
  return {
    id: pageURL,
    sourceKey: 'bluesky',
    sourceName: `블루스카이 · ${handle}`,
    pageURL,
    writtenAt: when.at,
    hasClock: when.hasClock,
    summary: front(text, 180),
  };
}

function blueskyQuery(tags: string[]): string {
  const place = tags.length === 1 ? tags[0] : `(${tags.join(' OR ')})`;
  return `${place} (사진 OR 촬영 OR photography OR photo OR camera)`;
}

interface FetchResult {
  status: number;
  ok: boolean;
  blocked: boolean;
  text: string;
  notes?: PublicNote[];
}

async function loadTagged(
  name: string,
  key: PublicNote['sourceKey'],
  tags: string[],
  loadTag: (tag: string) => Promise<FetchResult>,
): Promise<SourcePart> {
  const notes: PublicNote[] = [];
  let answered = false;
  let blocked = false;
  let failed = false;
  for (const tag of tags) {
    const page = await loadTag(tag);
    if (page.status !== 0) answered = true;
    if (page.blocked) {
      blocked = true;
      continue;
    }
    if (!page.ok || !page.notes) {
      failed = true;
      continue;
    }
    notes.push(...page.notes);
  }
  const uniqueNotes = tidy(notes).slice(0, PER_SOURCE);
  let detail: string;
  if (blocked && uniqueNotes.length === 0) detail = '응답이 막혀 있습니다. 우회하지 않습니다.';
  else if (!answered) detail = '연결하지 못했습니다.';
  else if (uniqueNotes.length === 0) detail = failed ? '공개 글을 읽지 못했습니다.' : '조건에 맞는 공개 글이 없습니다.';
  else detail = `공개 글 ${uniqueNotes.length}건을 가져왔습니다.`;
  return { key, notes: uniqueNotes, line: { name, detail, answered } };
}

function countLine(name: string, count: number, page: FetchResult): PublicSourceLine {
  if (page.blocked) return { name, detail: '응답이 막혀 있습니다. 우회하지 않습니다.', answered: true };
  if (!page.ok) {
    return {
      name,
      detail: page.status === 0 ? '연결하지 못했습니다.' : '공개 검색을 읽지 못했습니다.',
      answered: page.status !== 0,
    };
  }
  return {
    name,
    detail: count === 0 ? '조건에 맞는 공개 글이 없습니다.' : `공개 글 ${count}건을 가져왔습니다.`,
    answered: true,
  };
}

function recount(line: PublicSourceLine, key: PublicNote['sourceKey'], notes: PublicNote[]): PublicSourceLine {
  if (!line.detail.includes('가져왔습니다')) return line;
  const count = notes.filter((note) => note.sourceKey === key).length;
  return {
    ...line,
    detail: count === 0 ? '조건에 맞는 공개 글이 없습니다.' : `공개 글 ${count}건을 가져왔습니다.`,
  };
}

function keepNote(
  text: string,
  coords: { lat: number; lng: number } | null,
  needles: string[],
  query: PublicNotesQuery,
): boolean {
  if (!isPhotoStory(text)) return false;
  if (coords) {
    const meters = distanceMeters(query.center.lat, query.center.lng, coords.lat, coords.lng);
    if (meters <= (query.radiusKm + 0.3) * 1000) return true;
  }
  return mentionsPlace(text, needles);
}

function isPhotoStory(text: string): boolean {
  const body = text.replace(/https?:\/\/\S+/gi, ' ').trim();
  if ([...body].length < 8) return false;
  if (PHOTO_KO.some((word) => body.includes(word))) return true;
  return PHOTO_LATIN.test(body);
}

function mentionsPlace(text: string, needles: string[]): boolean {
  const lowered = text.toLowerCase();
  return needles.some((needle) => needle.length >= 2 && lowered.includes(needle.toLowerCase()));
}

function readCoords(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const bags = [row, asRecord(row.location), asRecord(row.geo), asRecord(row.place)];
  for (const bag of bags) {
    if (!bag) continue;
    const lat = asNumber(bag.lat ?? bag.latitude);
    const lng = asNumber(bag.lng ?? bag.lon ?? bag.longitude);
    if (lat == null || lng == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat, lng };
  }
  return null;
}

function tidy(notes: PublicNote[]): PublicNote[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const seen = new Set<string>();
  const ordered = [...notes].sort((left, right) => right.writtenAt - left.writtenAt);
  const kept: PublicNote[] = [];
  for (const note of ordered) {
    if (note.writtenAt < cutoff.getTime()) continue;
    if (seen.has(note.id)) continue;
    if (!note.summary.trim()) continue;
    seen.add(note.id);
    kept.push(note);
    if (kept.length === TOTAL) break;
  }
  return kept;
}

interface Page {
  status: number;
  ok: boolean;
  blocked: boolean;
  text: string;
}

async function fetchPage(
  url: string,
  options?: { method?: string; body?: string; contentType?: string },
): Promise<Page> {
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': 'ko' };
    if (options?.contentType) headers['Content-Type'] = options.contentType;
    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body,
      redirect: 'follow',
    });
    const status = response.status;
    const blocked = BLOCKED.has(status);
    const finalUrl = response.url || url;
    const ok = status >= 200 && status < 300 && finalUrl.startsWith('https://');
    const text = ok ? await response.text() : '';
    return { status, ok, blocked, text };
  } catch {
    return { status: 0, ok: false, blocked: false, text: '' };
  }
}

function parseArray(text: string): Record<string, unknown>[] {
  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const row = asRecord(item);
    return row ? [row] : [];
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function parseWhen(raw: string): { at: number; hasClock: boolean } | null {
  const text = raw.trim();
  if (!text) return null;
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return null;
  return { at, hasClock: /[T ][0-9]{2}:[0-9]{2}/.test(text) };
}

function httpsUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function plain(html: string): string {
  const noImage = html.replace(/<img\b[^>]*>/gi, ' ').replace(/!\[[^\]]*]\([^)]*\)/g, ' ');
  const broken = noImage.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  const stripped = broken.replace(/<[^>]+>/g, ' ');
  return unescapeHtml(stripped)
    .replace(/https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(\?\S*)?/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function unescapeHtml(raw: string): string {
  const named: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return raw.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, token: string) => {
    if (token.startsWith('#')) {
      const hex = token[1] === 'x' || token[1] === 'X';
      const code = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
      return String.fromCodePoint(code);
    }
    return named[token.toLowerCase()] ?? all;
  });
}

function front(text: string, limit: number): string {
  const chars = [...text];
  if (chars.length <= limit) return text;
  return `${chars.slice(0, limit).join('')}…`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
