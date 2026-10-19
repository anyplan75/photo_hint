import { useEffect, useRef, useState } from 'react';
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
}

export function PublicNotes({ placeName, center, radiusKm }: PublicNotesProps) {
  const centerRef = useRef(center);
  centerRef.current = center;
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [lines, setLines] = useState<PublicSourceLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
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

  const status = busy ? '가져오는 중' : fetchedAt ? `받은 시각 ${formatNoteWhen(fetchedAt, true)}` : '아직 안 받음';

  return (
    <section className="public-notes" aria-label="공개 사진글">
      <div className="public-notes-head">
        <h2>공개 사진글</h2>
        <span>{status}</span>
      </div>
      <p className="public-notes-caption">
        이 지역에서 로그인 없이 열린 사진 글입니다. 없는 글은 만들지 않습니다. 좌표가 없는 글은 지역 이름이 적힌 것만, 좌표가
        있는 글은 지금 반경 안에 있는 것만 보여 줍니다.
      </p>
      {notes.length === 0 ? (
        <p className="public-notes-empty">{busy ? '공개 글을 가져오는 중입니다.' : '지금 보여줄 공개 글이 없습니다.'}</p>
      ) : (
        <div className="public-notes-scroll">
          {notes.map((note) => (
            <article key={note.id} className="public-note" data-public-note={note.sourceKey}>
              <div className="public-note-top">
                <span className="public-note-source">{note.sourceName}</span>
                <time dateTime={new Date(note.writtenAt).toISOString()}>{formatNoteWhen(note.writtenAt, note.hasClock)}</time>
              </div>
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
