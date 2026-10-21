import { useEffect, useRef, useState } from 'react';
import { mapboxPublicToken } from './mapbox-token';
import {
  farFromMap,
  matchToRoad,
  movedMeters,
  routeBetween,
  type AddressHit,
  type MapPoint,
  type RoadOverlay,
  type SnappedPoint,
} from './map-tools';

/** 길 맞추기와 경로 안내입니다. 주소 찾기는 지도 왼쪽 위에 둡니다. */
export function RoadTools({
  center,
  address,
  onChange,
}: {
  center: MapPoint;
  address: AddressHit | null;
  onChange: (overlay: RoadOverlay) => void;
}) {
  const centerRef = useRef(center);
  centerRef.current = center;
  const addressRef = useRef(address);
  addressRef.current = address;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const frame = useRef(0);
  const [snapNote, setSnapNote] = useState('');
  const [routeNote, setRouteNote] = useState('');
  const [raw, setRaw] = useState<MapPoint | null>(null);
  const [snapped, setSnapped] = useState<SnappedPoint | null>(null);
  const [busy, setBusy] = useState<'snap' | 'route' | null>(null);
  const rawRef = useRef(raw);
  const snappedRef = useRef(snapped);
  rawRef.current = raw;
  snappedRef.current = snapped;

  function publish(next: {
    raw?: MapPoint | null;
    snapped?: SnappedPoint | null;
    route?: [number, number][] | null;
  }) {
    const rawPoint = next.raw === undefined ? rawRef.current : next.raw;
    const snappedPoint = next.snapped === undefined ? snappedRef.current : next.snapped;
    const route = next.route === undefined ? null : next.route;
    const addressPoint = addressRef.current;
    frame.current += 1;
    onChangeRef.current({
      address: addressPoint ? { lat: addressPoint.lat, lng: addressPoint.lng, label: addressPoint.label } : null,
      raw: rawPoint,
      snapped: snappedPoint ? { lat: snappedPoint.lat, lng: snappedPoint.lng } : null,
      route,
      frame: frame.current,
    });
  }

  useEffect(() => {
    frame.current += 1;
    onChangeRef.current({
      address: address ? { lat: address.lat, lng: address.lng, label: address.label } : null,
      raw: rawRef.current,
      snapped: snappedRef.current ? { lat: snappedRef.current.lat, lng: snappedRef.current.lng } : null,
      route: null,
      frame: frame.current,
    });
    setRouteNote('');
  }, [address]);

  async function snapPoint() {
    if (!mapboxPublicToken()) {
      setSnapNote('지도 암호가 없어 점을 길에 붙이지 못합니다.');
      return;
    }
    setBusy('snap');
    setSnapNote('점을 길 위에 붙이는 중');
    const here = centerRef.current;
    const gps = await readGps();
    let rawPoint = here;
    let subject = '지도 가운데 점을';
    if (gps && !farFromMap(gps, here)) {
      rawPoint = gps;
      subject = '현재 위치를';
    } else if (gps) {
      subject = '현재 위치가 이 지도와 멀리 있어, 지도 가운데 점을';
    } else {
      subject = '현재 위치를 받지 못해 지도 가운데 점을';
    }
    const controller = new AbortController();
    try {
      const matched = await matchToRoad(rawPoint, controller.signal);
      if (!matched) {
        setRaw(null);
        setSnapped(null);
        setSnapNote('이 점 근처에서 길을 찾지 못했습니다.');
        publish({ raw: null, snapped: null, route: null });
        return;
      }
      setRaw(rawPoint);
      setSnapped(matched);
      setRouteNote('');
      const moved = movedMeters(rawPoint, matched);
      const gap = moved >= 80 ? `가까운 길까지 ${moved >= 1000 ? `${(moved / 1000).toFixed(1)}km` : `${Math.round(moved)}m`}라서 ` : '';
      const where = matched.road ? `${matched.road} 위에` : '길 위에';
      setSnapNote(`${subject} ${gap}${where} 붙였습니다.`);
      publish({ raw: rawPoint, snapped: matched, route: null });
    } catch {
      setSnapNote('점을 길에 붙이지 못했습니다. 잠시 뒤 다시 시도하세요.');
    } finally {
      setBusy(null);
    }
  }

  async function drawRoute() {
    if (!snapped || !address) return;
    if (!mapboxPublicToken()) {
      setRouteNote('지도 암호가 없어 길을 계산하지 못합니다.');
      return;
    }
    setBusy('route');
    setRouteNote('두 지점 사이 길을 계산하는 중');
    const controller = new AbortController();
    try {
      const path = await routeBetween(snapped, address, controller.signal);
      if (!path) {
        setRouteNote('두 지점 사이 길을 계산하지 못했습니다.');
        publish({ route: null });
        return;
      }
      setRouteNote(path.summary);
      publish({ route: path.coordinates });
    } catch {
      setRouteNote('길을 계산하지 못했습니다. 잠시 뒤 다시 시도하세요.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="road-tools" data-road-tools aria-label="길 도구">
      <div>
        <h3>길 맞추기</h3>
        <p>흔들리는 GPS 점을 길 위에 붙입니다.</p>
        <button className="field-btn" type="button" disabled={busy === 'snap'} onClick={() => void snapPoint()}>
          이 점 맞추기
        </button>
        {snapNote && <p data-snap-note>{snapNote}</p>}
      </div>
      <div>
        <h3>경로 안내</h3>
        <p>두 지점 사이 길을 계산합니다.</p>
        <p className="road-ends">
          출발 {snapped ? snapped.road || '길에 붙인 점' : '아직 없음'}
          {' · '}
          도착 {address ? address.name : '아직 없음'}
        </p>
        <button className="field-btn good" type="button" disabled={!snapped || !address || busy === 'route'} onClick={() => void drawRoute()}>
          길 계산
        </button>
        {routeNote && <p data-route-note>{routeNote}</p>}
      </div>
    </section>
  );
}

function readGps(): Promise<MapPoint | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
    );
  });
}
