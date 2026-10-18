import { useEffect, useRef, useState, type FormEvent } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxPublicToken } from './mapbox-token';
import type { RankedSpot } from './region-places';
import { addShootPoint, loadShootPoints, removeShootPoint, type ShootPoint } from './shoot-points';

export function ShootMap({
  region,
  center,
  spots,
  activeOsm,
  onSelect,
}: {
  region: string;
  center: { lat: number; lng: number } | null;
  spots: RankedSpot[];
  activeOsm: string;
  onSelect: (osm: string) => void;
}) {
  const token = mapboxPublicToken();
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const fitted = useRef('');
  onSelectRef.current = onSelect;
  const [points, setPoints] = useState<ShootPoint[]>(() => loadShootPoints(region));
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    setPoints(loadShootPoints(region));
    setDraft(null);
    setName('');
    fitted.current = '';
  }, [region]);

  useEffect(() => {
    if (!token || !canvas.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      accessToken: token,
      container: canvas.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: center ? [center.lng, center.lat] : [126.55, 33.38],
      zoom: center ? 9 : 8,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (event) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest('.map-pin')) return;
      setDraft({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      setName('');
    });
    mapRef.current = map;
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => {
      window.cancelAnimationFrame(frame);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;
    const draw = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      const bounds = new mapboxgl.LngLatBounds();
      for (const spot of spots) {
        bounds.extend([spot.lng, spot.lat]);
        markersRef.current.push(placeMarker(map, spot, spot.osm === activeOsm, (osm) => onSelectRef.current(osm)));
      }
      for (const point of points) {
        bounds.extend([point.lng, point.lat]);
        markersRef.current.push(userMarker(map, point));
      }
      if (draft) {
        markersRef.current.push(draftMarker(map, draft.lat, draft.lng));
      }
      const fitKey = `${region}:${spots.map((spot) => spot.osm).join(',')}:${points.map((point) => point.id).join(',')}`;
      if (fitted.current !== fitKey) {
        fitted.current = fitKey;
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
        else if (center) map.jumpTo({ center: [center.lng, center.lat], zoom: 9 });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
    return () => {
      map.off('load', draw);
    };
  }, [token, region, center, spots, activeOsm, points, draft]);

  function savePoint(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!draft || !trimmed) return;
    const point: ShootPoint = {
      id: crypto.randomUUID(),
      region,
      name: trimmed,
      lat: draft.lat,
      lng: draft.lng,
      savedAt: new Date().toISOString(),
    };
    setPoints(addShootPoint(point));
    setDraft(null);
    setName('');
  }

  return (
    <section className="shoot-map panel" aria-labelledby="map-title" data-map={token ? 'ready' : 'missing'}>
      <div className="panel-head">
        <h2 id="map-title">지도</h2>
        <p>추천 장소와 이번 주 선정, 직접 남긴 촬영 지점입니다.</p>
      </div>
      {token ? (
        <>
          <div ref={canvas} className="map-canvas" data-map-canvas />
          <p className="note">지도를 누르면 촬영 지점을 남길 수 있습니다. 이 브라우저에만 저장되고, 계정은 없습니다.</p>
          <p className="map-legend">
            <span className="map-pin weekly" aria-hidden="true" /> 이번 주 선정
            <span className="map-pin" aria-hidden="true" /> 추천 장소
            <span className="map-pin mine" aria-hidden="true" /> 저장한 지점
          </p>
          {draft && (
            <form className="search" data-point-form onSubmit={savePoint}>
              <label className="sr" htmlFor="point-name">
                지점 이름
              </label>
              <input
                id="point-name"
                name="point-name"
                value={name}
                placeholder="촬영 지점 이름"
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                required
              />
              <button className="ghost slim" type="submit">
                저장
              </button>
              <button className="ghost slim" type="button" onClick={() => setDraft(null)}>
                취소
              </button>
            </form>
          )}
        </>
      ) : (
        <p data-map-note>지도를 표시하려면 Mapbox 공개 토큰이 필요합니다.</p>
      )}
      {points.length > 0 && (
        <ul className="user-points" data-user-points>
          {points.map((point) => (
            <li key={point.id} data-user-point={point.name}>
              <span>{point.name}</span>
              <button type="button" onClick={() => setPoints(removeShootPoint(region, point.id))}>
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function placeMarker(map: mapboxgl.Map, spot: RankedSpot, weekly: boolean, onSelect: (osm: string) => void): mapboxgl.Marker {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = weekly ? 'map-pin weekly' : 'map-pin';
  element.dataset.pin = spot.name;
  element.dataset.pinRole = weekly ? 'weekly' : 'place';
  element.setAttribute('aria-label', weekly ? `${spot.name}, 이번 주 선정` : spot.name);
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(spot.osm);
  });
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([spot.lng, spot.lat]).addTo(map);
}

function userMarker(map: mapboxgl.Map, point: ShootPoint): mapboxgl.Marker {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'map-pin mine';
  element.dataset.userPin = point.name;
  element.setAttribute('aria-label', point.name);
  element.addEventListener('click', (event) => event.stopPropagation());
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([point.lng, point.lat]).addTo(map);
}

function draftMarker(map: mapboxgl.Map, lat: number, lng: number): mapboxgl.Marker {
  const element = document.createElement('span');
  element.className = 'map-pin draft';
  element.dataset.draftPin = 'true';
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
}
