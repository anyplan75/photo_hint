export type SourceId = '1x' | '1650' | 'lensculture' | 'worldpress' | 'illume' | 'contentpool';

export const SOURCE_NAME: Record<SourceId, string> = {
  '1x': '1x',
  '1650': '1650Gallery',
  lensculture: 'LensCulture',
  worldpress: 'World Press Photo',
  illume: '레드불 일루미네이트',
  contentpool: '레드불 콘텐츠 풀',
};

export function referenceKey(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  return `${host}${path}`;
}

export function sourceOf(url: URL): SourceId | null {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === '1x.com' || host.endsWith('.1x.com')) return '1x';
  if (host === '1650gallery.com') return '1650';
  if (host === 'lensculture.com') return 'lensculture';
  if (host === 'worldpressphoto.org') return 'worldpress';
  if (host === 'redbullcontentpool.com') return 'contentpool';
  if (host === 'redbullillume.com' || host.endsWith('.redbullillume.com')) return 'illume';
  if ((host === 'redbull.com' || host.endsWith('.redbull.com')) && /illume/i.test(url.pathname)) return 'illume';
  return null;
}

export function parseReferenceAddress(raw: string): { url: string; source: SourceId } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: '페이지 주소를 붙여 넣으세요.' };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { error: '페이지 주소 형식이 아닙니다.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: '페이지 주소 형식이 아닙니다.' };
  }
  const source = sourceOf(parsed);
  if (!source) {
    return {
      error: '1x, 1650Gallery, LensCulture, World Press Photo, 레드불 일루미네이트, 레드불 콘텐츠 풀의 주소만 넣을 수 있습니다.',
    };
  }
  parsed.hash = '';
  return { url: parsed.toString(), source };
}
