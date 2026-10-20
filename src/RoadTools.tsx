import { useRef, useState, type FormEvent } from 'react';
import { mapboxPublicToken } from './mapbox-token';
import {
  farFromMap,
  forwardAddress,
  matchToRoad,
  movedMeters,
  routeBetween,
  type AddressHit,
  type MapPoint,
  type RoadOverlay,
  type SnappedPoint,
} from './map-tools';

/** 주소 검색, 길 맞추기, 경로 안내. 지도 밖 목록 칸에 둡니다. */
export function RoadTools({
  center,
  onChange,
}: {
  center: MapPoint;
  onChange: (overlay: RoadOverlay) => void;
}) {
  const centerRef = useRef(center);
  centerRef.current = center;
  const frame = useRef(0);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [addressNote, setAddressNote] = useState('');
  const [snapNote, setSnapNote] = useState('');
  const [routeNote, setRouteNote] = useState('');
  const [address, setAddress] = useState<AddressHit | null>(null);
  const [raw, setRaw] = useState<MapPoint | null>(null);
  const [snapped, setSnapped] = useState<SnappedPoint | null>(null);
  const [busy, setBusy] = useState<'address' | 'snap' | 'route' | null>(null);

  function publish(next: {
    address?: AddressHit | null;
    raw?: MapPoint | null;
    snapped?: SnappedPoint | null;
    route?: [number, number][] | null;
  }) {
    const addressPoint = next.address === undefined ? address : next.address;
    const rawPoint = next.raw === undefined ? raw : next.raw;
    const snappedPoint = next.snapped === undefined ? snapped : next.snapped;
    const route = next.route === undefined ? null : next.route;
    frame.current += 1;
    onChange({
      address: addressPoint ? { lat: addressPoint.lat, lng: addressPoint.lng, label: addressPoint.label } : null,
      raw: rawPoint,
      snapped: snappedPoint ? { lat: snappedPoint.lat, lng: snappedPoint.lng } : null,
      route,
      frame: frame.current,
    });
  }

  async function findAddress(event: FormEvent) {
    event.preventDefault();
    const name = query.trim();
    if (!name) return;
    if (!mapboxPublicToken()) {
      setAddressNote('지도 암호가 없어 주소를 찾지 못합니다.');
      setHits([]);
      return;
    }
    const controller = new AbortController();
    setBusy('address');
    setAddressNote('주소를 지도 위치로 바꾸는 중');
    try {
      const found = await forwardAddress(name, centerRef.current.lat, centerRef.current.lng, controller.signal);
      setHits(found);
      setAddressNote(found.length === 0 ? '그 주소를 찾지 못했습니다.' : '');
    } catch {
      setHits([]);
      setAddressNote('주소를 찾지 못했습니다. 잠시 뒤 다시 시도하세요.');
    } finally {
      setBusy(null);
    }
  }

  function chooseAddress(hit: AddressHit) {
    setAddress(hit);
    setHits([]);
    setQuery(hit.label);
    setAddressNote(`${hit.label} 위치를 지도에 표시했습니다.`);
    setRouteNote('');
    publish({ address: hit, route: null });
  }

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
      <form onSubmit={findAddress}>
        <h3>주소 검색</h3>
        <p>식당과 숙소 주소를 지도 위치로 바꿉니다.</p>
        <div className="control-search">
          <label className="sr" htmlFor="address-query">
            주소 검색
          </label>
          <input
            id="address-query"
            name="address"
            value={query}
            placeholder="식당·숙소 주소"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          <button className="field-btn sea" type="submit" disabled={busy === 'address'}>
            찾기
          </button>
        </div>
        {hits.length > 0 && (
          <div className="control-hits">
            {hits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => chooseAddress(hit)}>
                {hit.label}
              </button>
            ))}
          </div>
        )}
        {addressNote && <p data-address-note>{addressNote}</p>}
      </form>
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
