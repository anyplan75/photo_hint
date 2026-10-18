import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { shootingGuide, type GuideBlock } from './guide';
import { mapboxPublicToken } from './mapbox-token';
import type { WindowKind } from './places';
import { recommendTime, sunPlan } from './recommend';
import { cardinal, type RankedSpot, type SceneChoice } from './region-places';
import type { ShootPoint } from './shoot-points';
import { useSyncedShootPoints } from './use-shoot-points';

type PinSelection = { kind: 'spot'; osm: string } | { kind: 'point'; id: string };

interface SelectionView {
  role: 'weekly' | 'place' | 'point';
  roleLabel: string;
  name: string;
  address: string;
  time: string;
  coords: string;
  guide: { lead: string; blocks: GuideBlock[] };
}

type MapView = '2d' | '3d';

const DEM_SOURCE = 'geuttae-dem';
const BUILDINGS_LAYER = 'geuttae-3d-buildings';

export function ShootMap({
  region,
  center,
  spots,
  activeOsm,
  onSelect,
  scene,
  basis,
  windowKind,
  now,
  sessionReady,
  uid,
}: {
  region: string;
  center: { lat: number; lng: number } | null;
  spots: RankedSpot[];
  activeOsm: string;
  onSelect: (osm: string) => void;
  scene: SceneChoice | null;
  basis: string;
  windowKind: WindowKind;
  now: Date;
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
  const [selected, setSelected] = useState<PinSelection | null>(null);
  const infoRef = useRef<HTMLElement>(null);
  const ignoreMapClick = useRef(false);
  function holdMapClick() {
    ignoreMapClick.current = true;
    window.setTimeout(() => {
      ignoreMapClick.current = false;
    }, 0);
  }
  const [view, setView] = useState<MapView>('2d');
  const [pitch, setPitch] = useState(0);
  const viewRef = useRef<MapView>('2d');
  const viewReady = useRef(false);
  viewRef.current = view;

  useEffect(() => {
    setDraft(null);
    setName('');
    setPointError(null);
    setSelected(null);
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
      if (ignoreMapClick.current) {
        ignoreMapClick.current = false;
        return;
      }
      if (target instanceof Element && target.closest('.map-pin, .map-info')) return;
      setSelected(null);
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
        const picked = selected?.kind === 'spot' && selected.osm === spot.osm;
        markersRef.current.push(
          placeMarker(map, spot, spot.osm === activeOsm, picked, () => {
            holdMapClick();
            setSelected({ kind: 'spot', osm: spot.osm });
            setDraft(null);
            setName('');
            onSelectRef.current(spot.osm);
          }),
        );
      }
      for (const point of points) {
        bounds.extend([point.lng, point.lat]);
        const picked = selected?.kind === 'point' && selected.id === point.id;
        markersRef.current.push(
          userMarker(map, point, picked, () => {
            holdMapClick();
            setSelected({ kind: 'point', id: point.id });
            setDraft(null);
            setName('');
          }),
        );
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
  }, [token, region, center, spots, activeOsm, points, draft, selected]);

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

  const selectionView = describeSelection({ selected, spots, points, activeOsm, scene, basis, windowKind, now });
  const selectionKey = selected ? (selected.kind === 'spot' ? `spot:${selected.osm}` : `point:${selected.id}`) : '';

  useEffect(() => {
    const node = infoRef.current;
    if (!node || !selectionKey) return;
    node.focus({ preventScroll: true });
    const wide = window.matchMedia('(min-width: 960px)').matches;
    node.scrollIntoView({ behavior: 'smooth', block: wide ? 'nearest' : 'start' });
  }, [selectionKey]);

  return (
    <section
      className="shoot-map panel"
      aria-labelledby="map-title"
      data-map={token ? 'ready' : 'missing'}
      data-map-view={view}
      data-map-pitch={pitch}
      data-sync={mode}
      data-selected-place={selectionView?.name ?? ''}
    >
      <div className="panel-head">
        <h2 id="map-title">지도</h2>
        <p>핀을 누르면 그 자리의 주소, 시간, 렌즈와 장비 안내가 열립니다.</p>
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
            {selectionView && <MapSelectionCard view={selectionView} cardRef={infoRef} onClose={() => setSelected(null)} />}
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
        <>
          <p data-map-note>지도를 표시하려면 Mapbox 공개 토큰이 필요합니다.</p>
          {selectionView && <MapSelectionCard view={selectionView} cardRef={infoRef} onClose={() => setSelected(null)} />}
        </>
      )}
      {points.length > 0 && (
        <ul className="user-points" data-user-points>
          {points.map((point) => (
            <li key={point.id} data-user-point={point.name}>
              <button
                type="button"
                className="point-name"
                aria-pressed={selected?.kind === 'point' && selected.id === point.id}
                onClick={() => {
                  setSelected({ kind: 'point', id: point.id });
                  setDraft(null);
                  setName('');
                }}
              >
                {point.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected?.kind === 'point' && selected.id === point.id) setSelected(null);
                  void removePoint(point.id);
                }}
              >
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

function placeMarker(map: mapboxgl.Map, spot: RankedSpot, weekly: boolean, picked: boolean, onPick: () => void): mapboxgl.Marker {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = weekly ? 'map-pin weekly' : 'map-pin';
  if (picked) element.classList.add('picked');
  element.dataset.pin = spot.name;
  element.dataset.pinRole = weekly ? 'weekly' : 'place';
  element.setAttribute('aria-label', weekly ? `${spot.name}, 이번 주 선정` : spot.name);
  element.setAttribute('aria-pressed', picked ? 'true' : 'false');
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    onPick();
  });
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([spot.lng, spot.lat]).addTo(map);
}

function userMarker(map: mapboxgl.Map, point: ShootPoint, picked: boolean, onPick: () => void): mapboxgl.Marker {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = picked ? 'map-pin mine picked' : 'map-pin mine';
  element.dataset.userPin = point.name;
  element.setAttribute('aria-label', point.name);
  element.setAttribute('aria-pressed', picked ? 'true' : 'false');
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    onPick();
  });
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([point.lng, point.lat]).addTo(map);
}

function draftMarker(map: mapboxgl.Map, lat: number, lng: number): mapboxgl.Marker {
  const element = document.createElement('span');
  element.className = 'map-pin draft';
  element.dataset.draftPin = 'true';
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
}

/** 고른 핀의 주소, 시간, 촬영 안내를 만듭니다. 없는 장소나 사진 설명은 만들지 않습니다. */
function describeSelection({
  selected,
  spots,
  points,
  activeOsm,
  scene,
  basis,
  windowKind,
  now,
}: {
  selected: PinSelection | null;
  spots: RankedSpot[];
  points: ShootPoint[];
  activeOsm: string;
  scene: SceneChoice | null;
  basis: string;
  windowKind: WindowKind;
  now: Date;
}): SelectionView | null {
  if (!selected) return null;
  if (selected.kind === 'spot') {
    const spot = spots.find((item) => item.osm === selected.osm);
    if (!spot) return null;
    const weekly = spot.osm === activeOsm;
    const plan = sunPlan(spot.lat, spot.lng, windowKind, now);
    const guide = scene
      ? shootingGuide(scene, basis, spot, plan)
      : { lead: '장면을 고르면 이 자리의 준비 안내가 이어집니다.', blocks: [] };
    return {
      role: weekly ? 'weekly' : 'place',
      roleLabel: weekly ? '이번 주 선정' : '추천 장소',
      name: spot.name,
      address: spot.address ?? '주소를 찾지 못했습니다.',
      time: plan.summary,
      coords: `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)} · ${spot.osm}`,
      guide,
    };
  }
  const point = points.find((item) => item.id === selected.id);
  if (!point) return null;
  const plan = sunPlan(point.lat, point.lng, windowKind, now);
  const blocks: GuideBlock[] = [{ heading: '도착', body: plan.arrive }];
  if (plan.azimuth !== null) {
    blocks.push({
      heading: '빛의 방향',
      body: `${plan.summary}. 빛은 ${cardinal(plan.azimuth)}쪽(방위 ${plan.azimuth}°)에서 옵니다.`,
    });
  }
  blocks.push(
    {
      heading: '렌즈',
      body: scene
        ? `이 자리는 이름을 붙여 저장한 지점입니다. ${scene} 장면에 맞춘 렌즈는 추천 장소 핀의 안내에 있습니다.`
        : '장면을 아직 고르지 않아 렌즈를 정하지 않습니다.',
    },
    {
      heading: '장비',
      body: point.note?.trim()
        ? `적어 둔 메모를 따릅니다. ${point.note.trim()}`
        : '적어 둔 메모가 없습니다. 장비는 추천 장소 핀의 안내를 봅니다.',
    },
  );
  return {
    role: 'point',
    roleLabel: '저장한 지점',
    name: point.name,
    address: '이 지점에 적어 둔 주소는 없습니다.',
    time: recommendTime(point.lat, point.lng, windowKind, now),
    coords: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
    guide: {
      lead: scene
        ? `직접 남긴 ‘${point.name}’입니다. 이번 주 장면은 ${scene}입니다. 시간은 이 좌표의 해로 계산했습니다.`
        : `직접 남긴 ‘${point.name}’입니다. 시간은 이 좌표의 해로 계산했습니다.`,
      blocks,
    },
  };
}

function MapSelectionCard({
  view,
  cardRef,
  onClose,
}: {
  view: SelectionView;
  cardRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  return (
    <article
      ref={cardRef}
      id="map-selection"
      className="map-info"
      tabIndex={-1}
      data-map-info
      data-map-info-role={view.role}
      aria-labelledby="map-selection-title"
    >
      <div className="map-info-head">
        <div>
          <p className="map-info-kicker">{view.roleLabel}</p>
          <h3 id="map-selection-title" data-place>
            {view.name}
          </h3>
        </div>
        <button type="button" className="map-info-close" onClick={onClose}>
          닫기
        </button>
      </div>
      <p data-address>{view.address}</p>
      <p data-time>{view.time}</p>
      <p className="dim">{view.coords}</p>
      <section className="prep" data-guide data-guide-address={view.address}>
        <h4>준비 안내</h4>
        <p data-guide-lead>{view.guide.lead}</p>
        {view.guide.blocks.map((block) => (
          <div key={block.heading}>
            <h5>{block.heading}</h5>
            <p>{block.body}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
