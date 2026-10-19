import { useEffect, useState } from 'react';
import { advisePlaces, aiAvailability, hasGeminiKey, type AiConnection } from './ai-brief';
import type { RankedPlace } from './collect';

/**
 * 인공지능 연결 상태를 보여 줍니다.
 * 암호가 없으면 추천 목록을 만들지 않습니다.
 */
export function AiStatus({ places, usingHere }: { places: RankedPlace[]; usingHere: boolean }) {
  const [connection, setConnection] = useState<AiConnection>(() => aiAvailability());
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!hasGeminiKey()) {
      setConnection(aiAvailability());
      setPicked([]);
      return;
    }
    if (places.length === 0) {
      setConnection({ state: 'checking', detail: '인공지능 암호는 있습니다. 줄 세울 자리가 아직 없습니다.' });
      setPicked([]);
      return;
    }
    const controller = new AbortController();
    setConnection({ state: 'checking', detail: '인공지능에 지금 위치의 자리 순서를 묻는 중입니다.' });
    void advisePlaces(
      places.slice(0, 12).map((place) => ({
        id: place.id,
        name: place.name,
        distanceKm: place.distanceKm,
        score: place.score,
      })),
      controller.signal,
    ).then((result) => {
      if (controller.signal.aborted) return;
      setConnection(result.status);
      setPicked(result.placeIds);
    });
    return () => controller.abort();
  }, [places]);

  const ordered = picked.flatMap((id) => {
    const place = places.find((item) => item.id === id);
    return place ? [place] : [];
  });
  const where = usingHere ? '지금 위치' : '저장한 지역';

  return (
    <section className="ai-status" data-ai={connection.state} aria-label="인공지능 연결">
      <h2>인공지능</h2>
      <p data-ai-detail>{connection.detail}</p>
      <p className="ai-where">{where}의 자리입니다. 장면 점수는 따로 계산합니다.</p>
      {connection.state === 'connected' && ordered.length > 0 && (
        <ol className="ai-picks">
          {ordered.map((place) => (
            <li key={place.id}>{place.name}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
