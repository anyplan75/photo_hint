import { useEffect, useRef, useState, type FormEvent } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxPublicToken } from './mapbox-token';
import type { RankedSpot } from './region-places';
import type { ShootPoint } from './shoot-points';
import { useSyncedShootPoints } from './use-shoot-points';

type MapView = '2d' | '3d';

const DEM_SOURCE = 'geuttae-dem';
const BUILDINGS_LAYER = 'geuttae-3d-buildings';

export function ShootMap({
  region,
  center,
  spots,
  activeOsm,
  onSelect,
  sessionReady,
  uid,
}: {
  region: string;
  center: { lat: number; lng: number } | null;
  spots: RankedSpot[];
  activeOsm: string;
  onSelect: (osm: string) => void;
  sessionReady: boolean;
  uid: string | null;
}) {
  const token = mapboxPublicToken();
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const fitted = useRef('');
  onSelectRef.current = onSelect;
  const { points, mode, error: syncError, addPoint, removePoint } = useSyncedShootPoints(region, uid, sessionReady);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState('');
  const [pointError, setPointError] = useState<string | null>(null);
  const [view, setView] = useState<MapView>('2d');
  const [pitch, setPitch] = useState(0);
  const viewRef = useRef<MapView>('2d');
  const viewReady = useRef(false);
  viewRef.current = view;

  useEffect(() => {
    setDraft(null);
    setName('');
    setPointError(null);
    fitted.current = '';
  }, [region]);

  useEffect(() => {
    const element = canvas.current;
    if (!token || !element) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      accessToken: token,
      container: element,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: center ? [center.lng, center.lat] : [126.55, 33.38],
      zoom: center ? 9 : 8,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    map.on('pitch', () => setPitch(Math.round(map.getPitch())));
    map.on('click', (event) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest('.map-pin')) return;
      setDraft({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      setName('');
    });
    mapRef.current = map;
    viewReady.current = false;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;
    const apply = () => {
      const animate = viewReady.current;
      viewReady.current = true;
      applyView(map, viewRef.current, animate);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
    };
  }, [token, view]);

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
        const tilted = viewRef.current === '3d';
        const camera = tilted ? { pitch: 60, bearing: -17 } : { pitch: 0, bearing: 0 };
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0, ...camera });
        else if (center) map.jumpTo({ center: [center.lng, center.lat], zoom: 9, ...camera });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
    return () => {
      map.off('load', draw);
    };
  }, [token, region, center, spots, activeOsm, points, draft]);

  async function savePoint(event: FormEvent) {
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
    try {
      await addPoint(point);
      setDraft(null);
      setName('');
      setPointError(null);
    } catch {
      setPointError('계정에 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  return (
    <section
      className="shoot-map panel"
      aria-labelledby="map-title"
      data-map={token ? 'ready' : 'missing'}
      data-map-view={view}
      data-map-pitch={pitch}
      data-sync={mode}
    >
      <div className="panel-head">
        <h2 id="map-title">지도</h2>
        <p>추천 장소와 이번 주 선정, 직접 남긴 촬영 지점입니다.</p>
      </div>
      {token ? (
        <>
          <div className="map-frame">
            <div ref={canvas} className="map-canvas" data-map-canvas data-terrain={view === '3d' ? 'on' : 'off'} />
            <div className="view-switch" role="group" aria-label="지도 보기">
              <button type="button" data-view="2d" aria-pressed={view === '2d'} className={view === '2d' ? 'on' : ''} onClick={() => setView('2d')}>
                2D 평면
              </button>
              <button type="button" data-view="3d" aria-pressed={view === '3d'} className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>
                3D 입체
              </button>
            </div>
          </div>
          <p className="note">{syncNote(mode)}</p>
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
          {(pointError || syncError) && <p className="note error">{pointError || syncError}</p>}
        </>
      ) : (
        <p data-map-note>지도를 표시하려면 Mapbox 공개 토큰이 필요합니다.</p>
      )}
      {points.length > 0 && (
        <ul className="user-points" data-user-points>
          {points.map((point) => (
            <li key={point.id} data-user-point={point.name}>
              <span>{point.name}</span>
              <button type="button" onClick={() => void removePoint(point.id)}>
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 평면은 위에서 내려다보는 지도이고, 입체는 기울인 지형과 건물입니다. 핀은 둘 다 남습니다. */
function applyView(map: mapboxgl.Map, view: MapView, animate: boolean): void {
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });
  }
  const duration = animate ? (view === '3d' ? 650 : 450) : 0;
  if (view === '3d') {
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.setTerrain({ source: DEM_SOURCE, exaggeration: 1.4 });
    showBuildings(map);
    map.setFog({
      color: 'rgb(232, 226, 214)',
      'high-color': 'rgb(176, 198, 224)',
      'horizon-blend': 0.08,
      'space-color': 'rgb(156, 178, 208)',
      'star-intensity': 0,
    });
    map.easeTo({ pitch: 60, bearing: -17, duration });
    map.getContainer().dataset.buildings = map.getLayer(BUILDINGS_LAYER) ? 'on' : 'off';
    return;
  }
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
  map.setTerrain(null);
  hideBuildings(map);
  map.setFog(null);
  map.easeTo({ pitch: 0, bearing: 0, duration });
  map.getContainer().dataset.buildings = 'off';
}

function extrusionIds(map: mapboxgl.Map): string[] {
  return (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.type === 'fill-extrusion' && 'source-layer' in layer && layer['source-layer'] === 'building')
    .map((layer) => layer.id);
}

function showBuildings(map: mapboxgl.Map): void {
  const existing = extrusionIds(map);
  if (existing.length > 0) {
    for (const id of existing) map.setLayoutProperty(id, 'visibility', 'visible');
    return;
  }
  const layers = map.getStyle()?.layers ?? [];
  const withBuildings = layers.find((layer) => 'source-layer' in layer && layer['source-layer'] === 'building' && 'source' in layer);
  const source =
    withBuildings && 'source' in withBuildings && typeof withBuildings.source === 'string'
      ? withBuildings.source
      : map.getSource('composite')
        ? 'composite'
        : null;
  if (!source) return;
  const labelLayerId = layers.find((layer) => layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout)?.id;
  try {
    map.addLayer(
      {
        id: BUILDINGS_LAYER,
        source,
        'source-layer': 'building',
        filter: ['any', ['==', ['get', 'extrude'], true], ['==', ['get', 'extrude'], 'true']],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#d7d0c4',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.75,
        },
      },
      labelLayerId,
    );
  } catch {
    // 이 지도 스타일에 건물 층이 없으면 지형만 기울입니다.
  }
}

function hideBuildings(map: mapboxgl.Map): void {
  for (const id of extrusionIds(map)) map.setLayoutProperty(id, 'visibility', 'none');
}

function syncNote(mode: 'local' | 'syncing' | 'synced' | 'error'): string {
  if (mode === 'synced') return '저장한 지점은 이 계정에 올라갑니다. 같은 아이디로 맥, 아이폰, 웹사이트에서 보입니다.';
  if (mode === 'syncing') return '계정에 저장된 촬영 지점을 맞추는 중입니다.';
  if (mode === 'error') return '계정과 맞추지 못했습니다. 로그인하지 않은 복사본은 계정을 덮어쓰지 않습니다.';
  return '로그인하지 않으면 이 브라우저에만 남습니다. 이렇게 남긴 복사본은 계정을 덮어쓰지 않습니다.';
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
