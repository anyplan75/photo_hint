import { useEffect, useRef, useState } from 'react';
import { advisePosts, aiAvailability, hasGeminiKey, type AiConnection } from './ai-brief';
import {
  loadPublicNotesCached,
  peekPublicNotes,
  type PublicNote,
  type PublicNotesBundle,
  type PublicSourceLine,
} from './public-notes';
import { SEOUL } from './time';

interface PublicNotesProps {
  placeName: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  nearbyNames: string[];
}

export function PublicNotes({ placeName, center, radiusKm, nearbyNames }: PublicNotesProps) {
  const centerRef = useRef(center);
  centerRef.current = center;
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [lines, setLines] = useState<PublicSourceLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [ai, setAi] = useState<AiConnection>(() => aiAvailability());
  const [picked, setPicked] = useState<string[]>([]);
  const ticket = useRef(0);

  useEffect(() => {
    const query = { placeName, center: centerRef.current, radiusKm };
    const current = ++ticket.current;
    const cached = peekPublicNotes(query);
    if (cached) {
      applyBundle(cached, setNotes, setLines, setFetchedAt);
      setBusy(false);
      return;
    }
    setNotes([]);
    setLines([]);
    setFetchedAt(null);
    setBusy(true);
    void loadPublicNotesCached(query).then((bundle) => {
      if (current !== ticket.current) return;
      applyBundle(bundle, setNotes, setLines, setFetchedAt);
      setBusy(false);
    });
  }, [placeName, radiusKm]);

  useEffect(() => {
    if (!hasGeminiKey()) {
      setAi(aiAvailability());
      setPicked([]);
      return;
    }
    if (notes.length === 0) {
      setAi(aiAvailability());
      setPicked([]);
      return;
    }
    const controller = new AbortController();
    setAi({ state: 'checking', detail: '인공지능에 받아 온 글의 순서를 묻는 중입니다.' });
    void advisePosts(
      notes.slice(0, 12).map((note) => ({ id: note.pageURL, summary: note.summary })),
      controller.signal,
    ).then((result) => {
      if (controller.signal.aborted) return;
      setAi(result.status);
      setPicked(result.postIds);
    });
    return () => controller.abort();
  }, [notes]);

  const status = busy ? '가져오는 중' : fetchedAt ? `받은 시각 ${formatNoteWhen(fetchedAt, true)}` : '아직 안 받음';
  const shown = orderNotes(notes, picked, nearbyNames);

  return (
    <section className="public-notes" aria-label="주변 공개 사진글">
      <div className="public-notes-head">
        <h2>주변 공개 사진글</h2>
        <span>{status}</span>
      </div>
      <p className="public-notes-caption" data-note-ai={ai.state}>
        {ai.detail} 이 반경에서 받아 온 글의 문장과 출처 링크만 보여 줍니다. 사진은 걸지 않습니다.
      </p>
      {shown.length === 0 ? (
        <p className="public-notes-empty">{busy ? '공개 글을 가져오는 중입니다.' : '지금 보여줄 공개 글이 없습니다.'}</p>
      ) : (
        <div className="public-notes-scroll">
          {shown.map((note) => (
            <article key={note.id} className="public-note" data-public-note={note.sourceKey}>
              <div className="public-note-top">
                <span className="public-note-source">{note.sourceName}</span>
                <time dateTime={new Date(note.writtenAt).toISOString()}>{formatNoteWhen(note.writtenAt, note.hasClock)}</time>
              </div>
              {mentionedPlaces(note.summary, nearbyNames).length > 0 && (
                <p className="public-note-place">이 글에 적힌 자리: {mentionedPlaces(note.summary, nearbyNames).join(', ')}</p>
              )}
              <p className="public-note-summary">{note.summary}</p>
              <a href={note.pageURL} target="_blank" rel="noopener noreferrer">
                출처 열기
              </a>
            </article>
          ))}
        </div>
      )}
      {lines.length > 0 && (
        <ul className="public-source-lines">
          {lines.map((line) => (
            <li key={line.name}>
              {line.name}: {line.detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function orderNotes(notes: PublicNote[], picked: string[], nearbyNames: string[]): PublicNote[] {
  const rank = new Map(picked.map((id, index) => [id, index]));
  return [...notes].sort((left, right) => {
    const leftPick = rank.get(left.pageURL);
    const rightPick = rank.get(right.pageURL);
    if (leftPick !== undefined || rightPick !== undefined) {
      return (leftPick ?? 999) - (rightPick ?? 999);
    }
    const leftHit = mentionedPlaces(left.summary, nearbyNames).length > 0 ? 0 : 1;
    const rightHit = mentionedPlaces(right.summary, nearbyNames).length > 0 ? 0 : 1;
    return leftHit - rightHit;
  });
}

function mentionedPlaces(summary: string, nearbyNames: string[]): string[] {
  return nearbyNames.filter((name) => name.length >= 2 && summary.includes(name));
}

function applyBundle(
  bundle: PublicNotesBundle,
  setNotes: (notes: PublicNote[]) => void,
  setLines: (lines: PublicSourceLine[]) => void,
  setFetchedAt: (at: number | null) => void,
): void {
  setNotes(bundle.notes);
  setLines(bundle.lines);
  setFetchedAt(bundle.fetchedAt);
}

export function formatNoteWhen(at: number, hasClock: boolean): string {
  const date = new Date(at);
  const day = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  if (!hasClock) return day;
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEOUL,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} ${clock}`;
}
