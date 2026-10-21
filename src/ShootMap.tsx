import { useEffect, useRef, useState, type FormEvent } from 'react';
import { rimPoint, type SkyRim } from './sightline';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { shootingGuide, type GuideBlock } from './guide';
import { mapboxPublicToken } from './mapbox-token';
import { forwardAddress, type AddressHit, type RoadOverlay } from './map-tools';
import { reverseAddress } from './search';
import type { WindowKind } from './places';
import { recommendTime, sunPlan } from './recommend';
import { cardinal, type RankedSpot, type SceneChoice } from './region-places';
import type { ShootPoint } from './shoot-points';
import { useSyncedShootPoints, type SyncMode } from './use-shoot-points';

type PinSelection = { kind: 'spot'; osm: string } | { kind: 'point'; id: string };

export interface SelectionView {
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
const ROUTE_SOURCE = 'geuttae-route';
const ROUTE_LAYER = 'geuttae-route-line';
const SNAP_SOURCE = 'geuttae-snap-link';
const SNAP_LAYER = 'geuttae-snap-link';
const SIGHT_SOURCE = 'geuttae-sight';
const SIGHT_LAYER = 'geuttae-sight-line';

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
  onView,
  onOpenGuide,
  dismissPoint = 0,
  bare = false,
  fly = null,
  onDrag,
  selectRequest = null,
  external = null,
  road = null,
  sight = null,
  onPlaceSight,
  rim = null,
  onAddress,
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
  /** 고른 핀의 짧은 안내를 지도 밖 칸으로 넘깁니다. */
  onView?: (view: SelectionView | null) => void;
  /** 핀을 누르면 안내 칸으로 돌아갑니다. */
  onOpenGuide?: () => void;
  /** 저장한 지점 안내를 닫고 이번 주 자리로 돌아갑니다. */
  dismissPoint?: number;
  /** 지도만 채웁니다. 점수 목록과 계정 문장은 바깥 화면이 맡습니다. */
  bare?: boolean;
  fly?: { lat: number; lng: number; token: number } | null;
  onDrag?: (lat: number, lng: number) => void;
  selectRequest?: PinSelection | null;
  external?: {
    points: ShootPoint[];
    mode: SyncMode;
    error: string | null;
    addPoint: (point: ShootPoint) => Promise<void>;
    removePoint: (id: string) => Promise<void>;
  } | null;
  /** 주소 위치, 길에 붙인 점, 두 지점 사이 길입니다. 지도 위 조작 칸은 아닙니다. */
  road?: RoadOverlay | null;
  /** 작가·대상·능선입니다. 조작 칸은 지도 밖에 둡니다. */
  sight?: {
    photographer: { lat: number; lng: number } | null;
    subject: { lat: number; lng: number } | null;
    ridge: { lat: number; lng: number } | null;
    placing: 'photographer' | 'subject' | null;
  } | null;
  onPlaceSight?: (lat: number, lng: number) => void;
  /** 해와 달의 방위입니다. 지도 테두리에 둡니다. */
  rim?: SkyRim | null;
  /** 지도 왼쪽 위 주소 검색이 고른 위치입니다. */
  onAddress?: (hit: AddressHit) => void;
}) {
  const token = mapboxPublicToken();
  const canvas = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const roadMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const roadHold = useRef(false);
  const onSelectRef = useRef(onSelect);
  const fitted = useRef('');
  onSelectRef.current = onSelect;
  const internal = useSyncedShootPoints(region, uid, sessionReady, external === null);
  const points = external?.points ?? internal.points;
  const mode = external?.mode ?? internal.mode;
  const syncError = external?.error ?? internal.error;
  const addPoint = external?.addPoint ?? internal.addPoint;
  const removePoint = external?.removePoint ?? internal.removePoint;
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  const onPlaceSightRef = useRef(onPlaceSight);
  onPlaceSightRef.current = onPlaceSight;
  const onAddressRef = useRef(onAddress);
  onAddressRef.current = onAddress;
  const placingRef = useRef(sight?.placing ?? null);
  placingRef.current = sight?.placing ?? null;
  const sightMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [draft, setDraft] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const [name, setName] = useState('');
  const [pointError, setPointError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PinSelection | null>(null);
  const ignoreMapClick = useRef(false);
  const onViewRef = useRef(onView);
  const onOpenGuideRef = useRef(onOpenGuide);
  const activeOsmRef = useRef(activeOsm);
  onViewRef.current = onView;
  onOpenGuideRef.current = onOpenGuide;
  activeOsmRef.current = activeOsm;
  function holdMapClick() {
    ignoreMapClick.current = true;
    window.setTimeout(() => {
      ignoreMapClick.current = false;
    }, 0);
  }
  const [pointAddress, setPointAddress] = useState<{ id: string; text: string | null } | null>(null);
  const [mapBearing, setMapBearing] = useState(0);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapView>('2d');
  const [pitch, setPitch] = useState(0);
  const sightFitRef = useRef('');
  const viewRef = useRef<MapView>('2d');
  const viewReady = useRef(false);
  viewRef.current = view;

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setFrameSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [token]);

  useEffect(() => {
    setDraft(null);
    setName('');
    setPointError(null);
    setSelected(null);
    fitted.current = '';
    roadHold.current = false;
  }, [region]);

  useEffect(() => {
    if (!activeOsm) return;
    setSelected((current) => {
      if (current?.kind === 'point') return current;
      if (current?.kind === 'spot' && current.osm === activeOsm) return current;
      return { kind: 'spot', osm: activeOsm };
    });
  }, [activeOsm]);

  useEffect(() => {
    if (dismissPoint === 0) return;
    const osm = activeOsmRef.current;
    setSelected(osm ? { kind: 'spot', osm } : null);
  }, [dismissPoint]);

  const selectKey = selectRequest ? (selectRequest.kind === 'spot' ? `spot:${selectRequest.osm}` : `point:${selectRequest.id}`) : '';
  const selectRef = useRef(selectRequest);
  selectRef.current = selectRequest;
  useEffect(() => {
    const request = selectRef.current;
    if (!request) return;
    setSelected(request);
    setDraft(null);
    setName('');
  }, [selectKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fly) return;
    const tilted = viewRef.current === '3d';
    const camera = tilted ? { pitch: 60, bearing: -17 } : { pitch: 0, bearing: 0 };
    map.easeTo({ center: [fly.lng, fly.lat], zoom: Math.max(map.getZoom(), 10), duration: 500, ...camera });
  }, [fly?.token]);

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
    const rememberBearing = () => setMapBearing(map.getBearing());
    map.on('rotate', rememberBearing);
    map.on('load', rememberBearing);
    map.on('dragend', () => {
      const next = map.getCenter();
      onDragRef.current?.(next.lat, next.lng);
    });
    map.on('click', (event) => {
      const target = event.originalEvent.target;
      if (ignoreMapClick.current) {
        ignoreMapClick.current = false;
        return;
      }
      if (target instanceof Element && target.closest('.map-pin, .map-info, .map-search, .point-save')) return;
      if (placingRef.current) onPlaceSightRef.current?.(event.lngLat.lat, event.lngLat.lng);
    });
    map.on('contextmenu', (event) => {
      event.preventDefault();
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest('.map-pin, .map-info, .map-search, .point-save')) return;
      setDraft({ lat: event.lngLat.lat, lng: event.lngLat.lng, x: event.point.x, y: event.point.y });
      setName('');
      setPointError(null);
    });
    const blockMenu = (event: Event) => event.preventDefault();
    map.getCanvas().addEventListener('contextmenu', blockMenu);
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
      sightMarkersRef.current.forEach((marker) => marker.remove());
      sightMarkersRef.current = [];
      map.getCanvas().removeEventListener('contextmenu', blockMenu);
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
            onOpenGuideRef.current?.();
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
            onOpenGuideRef.current?.();
          }),
        );
      }
      if (draft) {
        markersRef.current.push(draftMarker(map, draft.lat, draft.lng));
      }
      const fitKey = `${region}:${spots.map((spot) => spot.osm).join(',')}:${points.map((point) => point.id).join(',')}`;
      if (!roadHold.current && fitted.current !== fitKey) {
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

  const roadKey = road
    ? `${road.frame}|${road.address?.lng ?? ''},${road.address?.lat ?? ''}|${road.raw?.lng ?? ''},${road.raw?.lat ?? ''}|${road.snapped?.lng ?? ''},${road.snapped?.lat ?? ''}|${road.route?.length ?? 0}`
    : '';
  const roadRef = useRef(road);
  roadRef.current = road;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;
    const drawRoad = () => {
      const overlay = roadRef.current;
      roadMarkersRef.current.forEach((marker) => marker.remove());
      roadMarkersRef.current = [];
      if (!overlay || overlay.frame === 0) {
        roadHold.current = false;
        setLine(map, ROUTE_SOURCE, ROUTE_LAYER, null, false);
        setLine(map, SNAP_SOURCE, SNAP_LAYER, null, true);
        return;
      }
      roadHold.current = true;
      if (overlay.address) {
        roadMarkersRef.current.push(roadMarker(map, overlay.address.lat, overlay.address.lng, 'map-pin address', overlay.address.label, { addressPin: overlay.address.label }));
      }
      if (overlay.raw) {
        roadMarkersRef.current.push(roadMarker(map, overlay.raw.lat, overlay.raw.lng, 'map-pin raw', '흔들리는 점', { rawPin: 'true' }));
      }
      if (overlay.snapped) {
        roadMarkersRef.current.push(roadMarker(map, overlay.snapped.lat, overlay.snapped.lng, 'map-pin snapped', '길에 붙인 점', { snappedPin: 'true' }));
      }
      setLine(map, ROUTE_SOURCE, ROUTE_LAYER, overlay.route, false);
      const snapLink =
        overlay.raw && overlay.snapped ? ([[overlay.raw.lng, overlay.raw.lat], [overlay.snapped.lng, overlay.snapped.lat]] as [number, number][]) : null;
      setLine(map, SNAP_SOURCE, SNAP_LAYER, snapLink, true);
      const bounds = new mapboxgl.LngLatBounds();
      if (overlay.address) bounds.extend([overlay.address.lng, overlay.address.lat]);
      if (overlay.raw) bounds.extend([overlay.raw.lng, overlay.raw.lat]);
      if (overlay.snapped) bounds.extend([overlay.snapped.lng, overlay.snapped.lat]);
      for (const pair of overlay.route ?? []) bounds.extend(pair);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 72, maxZoom: overlay.route && overlay.route.length > 1 ? 13.5 : 16, duration: 700 });
    };
    if (map.isStyleLoaded()) drawRoad();
    else {
      const once = () => {
        if (!map.isStyleLoaded()) return;
        map.off('idle', once);
        drawRoad();
      };
      map.on('idle', once);
      return () => {
        map.off('idle', once);
      };
    }
  }, [token, roadKey]);

  const sightKey = sight
    ? `${sight.photographer?.lng ?? ''},${sight.photographer?.lat ?? ''}|${sight.subject?.lng ?? ''},${sight.subject?.lat ?? ''}|${sight.ridge?.lng ?? ''},${sight.ridge?.lat ?? ''}`
    : '';
  const sightRef = useRef(sight);
  sightRef.current = sight;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !token) return;
    const drawSight = () => {
      const overlay = sightRef.current;
      sightMarkersRef.current.forEach((marker) => marker.remove());
      sightMarkersRef.current = [];
      if (!overlay) {
        setLine(map, SIGHT_SOURCE, SIGHT_LAYER, null, true);
        return;
      }
      if (overlay.photographer) {
        sightMarkersRef.current.push(sightMarker(map, overlay.photographer.lat, overlay.photographer.lng, 'author', '작가'));
      }
      if (overlay.subject) {
        sightMarkersRef.current.push(sightMarker(map, overlay.subject.lat, overlay.subject.lng, 'subject', '대상'));
      }
      if (overlay.ridge) {
        sightMarkersRef.current.push(sightMarker(map, overlay.ridge.lat, overlay.ridge.lng, 'ridge', '능선'));
      }
      const line =
        overlay.photographer && overlay.subject
          ? ([[overlay.photographer.lng, overlay.photographer.lat], [overlay.subject.lng, overlay.subject.lat]] as [number, number][])
          : null;
      setLine(map, SIGHT_SOURCE, SIGHT_LAYER, line, true, '#8ed4ff');
      const pairKey = line ? `${line[0].join(',')}|${line[1].join(',')}` : '';
      if (line && sightFitRef.current !== pairKey) {
        sightFitRef.current = pairKey;
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(line[0]);
        bounds.extend(line[1]);
        map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 600 });
      }
    };
    if (map.isStyleLoaded()) drawSight();
    else map.once('load', drawSight);
    return () => {
      map.off('load', drawSight);
    };
  }, [token, sightKey]);

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

  const selectedPoint = selected?.kind === 'point' ? points.find((item) => item.id === selected.id) : undefined;
  useEffect(() => {
    if (!selectedPoint || !Number.isFinite(selectedPoint.lat) || !Number.isFinite(selectedPoint.lng)) return;
    const controller = new AbortController();
    const id = selectedPoint.id;
    setPointAddress({ id, text: null });
    void reverseAddress(selectedPoint.lat, selectedPoint.lng, controller.signal)
      .then((address) => {
        if (controller.signal.aborted) return;
        setPointAddress({ id, text: address ?? '' });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPointAddress({ id, text: '' });
      });
    return () => controller.abort();
  }, [selectedPoint?.id, selectedPoint?.lat, selectedPoint?.lng]);

  const selectionView = describeSelection({
    selected,
    spots,
    points,
    activeOsm,
    scene,
    basis,
    windowKind,
    now,
    pointAddress: pointAddress && selectedPoint && pointAddress.id === selectedPoint.id ? pointAddress.text : null,
  });
  const reported = selectionView
    ? `${selectionView.role}|${selectionView.name}|${selectionView.time}|${selectionView.address}|${selectionView.guide.lead}|${selectionView.guide.blocks.map((block) => block.heading).join(',')}`
    : '';
  const selectionViewRef = useRef(selectionView);
  selectionViewRef.current = selectionView;

  useEffect(() => {
    onViewRef.current?.(selectionViewRef.current);
  }, [reported]);

  return (
    <section
      className={bare ? 'shoot-map bare' : 'shoot-map panel'}
      aria-labelledby="map-title"
      data-map={token ? 'ready' : 'missing'}
      data-map-view={view}
      data-map-pitch={pitch}
      data-sync={mode}
      data-selected-place={selectionView?.name ?? ''}
      data-route={road?.route && road.route.length > 1 ? 'on' : 'off'}
      data-route-count={road?.route?.length ?? 0}
      data-placing={sight?.placing ?? ''}
      data-sight-line={sight?.photographer && sight?.subject ? 'on' : 'off'}
      data-saved-count={points.length}
      data-point-draft={draft ? 'open' : 'closed'}
    >
      <h2 id="map-title" className="sr">
        지도
      </h2>
      {token ? (
        <>
          <div className="map-frame" ref={frameRef}>
            <div ref={canvas} className="map-canvas" data-map-canvas data-terrain={view === '3d' ? 'on' : 'off'} />
            {rim && frameSize.width > 0 ? <MapRim rim={rim} bearing={mapBearing} width={frameSize.width} height={frameSize.height} /> : null}
            <MapAddressSearch center={center} onPick={(hit) => onAddressRef.current?.(hit)} />
            {draft ? (
              <form
                className="point-save"
                data-point-form
                style={{ left: clamp(draft.x, frameSize.width, 210), top: clamp(draft.y, frameSize.height, 132) }}
                onSubmit={savePoint}
                onMouseDown={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <p>
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </p>
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
            ) : null}
            <div className="view-switch" role="group" aria-label="지도 보기">
              <button type="button" data-view="2d" aria-pressed={view === '2d'} className={view === '2d' ? 'on' : ''} onClick={() => setView('2d')}>
                2D 평면
              </button>
              <button type="button" data-view="3d" aria-pressed={view === '3d'} className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>
                3D 입체
              </button>
            </div>
          </div>
          {!bare && <p className="note">{syncNote(mode)}</p>}
          {!bare && (
            <p className="map-legend">
              <span className="map-pin weekly" aria-hidden="true" /> 이번 주 선정
              <span className="map-pin" aria-hidden="true" /> 추천 장소
              <span className="map-pin mine" aria-hidden="true" /> 저장한 지점
            </p>
          )}
          {(pointError || syncError) && <p className="note error">{pointError || syncError}</p>}
        </>
      ) : (
        <>
          <p data-map-note>지도를 표시하려면 Mapbox 공개 토큰이 필요합니다.</p>
        </>
      )}
      {!bare && points.length > 0 && (
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
                  onOpenGuide?.();
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

function savedPointAddress(point: ShootPoint, lookedUp: string | null): string {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return '이 지점에 적어 둔 주소는 없습니다.';
  if (lookedUp === null) return '주소를 찾는 중입니다.';
  return lookedUp || '주소를 찾지 못했습니다.';
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

function roadMarker(
  map: mapboxgl.Map,
  lat: number,
  lng: number,
  className: string,
  label: string,
  data: Record<string, string>,
): mapboxgl.Marker {
  const element = document.createElement('span');
  element.className = className;
  element.setAttribute('aria-label', label);
  element.title = label;
  for (const [key, value] of Object.entries(data)) element.dataset[key] = value;
  element.addEventListener('click', (event) => event.stopPropagation());
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
}

function sightMarker(map: mapboxgl.Map, lat: number, lng: number, role: 'author' | 'subject' | 'ridge', label: string): mapboxgl.Marker {
  const element = document.createElement('span');
  element.className = `map-pin ${role}`;
  element.dataset.sightPin = role;
  element.textContent = role === 'ridge' ? '' : label.slice(0, 1);
  element.setAttribute('aria-label', label);
  element.addEventListener('click', (event) => event.stopPropagation());
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
}

function setLine(
  map: mapboxgl.Map,
  sourceId: string,
  layerId: string,
  coordinates: [number, number][] | null,
  dashed: boolean,
  color?: string,
): void {
  const data =
    coordinates && coordinates.length > 1
      ? { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }
      : { type: 'FeatureCollection' as const, features: [] };
  const source = map.getSource(sourceId);
  if (!source) map.addSource(sourceId, { type: 'geojson', data });
  else (source as mapboxgl.GeoJSONSource).setData(data);
  const paint = dashed
    ? { 'line-color': color ?? '#ffb199', 'line-width': 3, 'line-dasharray': [2, 2] }
    : { 'line-color': color ?? '#d6f25c', 'line-width': 6 };
  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      slot: 'top',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint,
    });
    return;
  }
  map.setPaintProperty(layerId, 'line-color', paint['line-color']);
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
  pointAddress = null,
}: {
  selected: PinSelection | null;
  spots: RankedSpot[];
  points: ShootPoint[];
  activeOsm: string;
  scene: SceneChoice | null;
  basis: string;
  windowKind: WindowKind;
  now: Date;
  /** 좌표로 찾아 온 주소. 빈 문자열이면 찾지 못한 상태입니다. */
  pointAddress?: string | null;
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
    address: savedPointAddress(point, pointAddress),
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

function clamp(value: number, span: number, box: number): number {
  const limit = Math.max(8, span - box);
  return Math.min(Math.max(8, value), limit);
}

/** 지도 왼쪽 위에 붙는 짧은 주소 검색입니다. 오른쪽 목록에는 두지 않습니다. */
function MapAddressSearch({
  center,
  onPick,
}: {
  center: { lat: number; lng: number } | null;
  onPick: (hit: AddressHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function findAddress(event: FormEvent) {
    event.preventDefault();
    const name = query.trim();
    if (!name) return;
    const here = center ?? { lat: 33.38, lng: 126.55 };
    const controller = new AbortController();
    setBusy(true);
    setNote('주소를 찾는 중');
    try {
      const found = await forwardAddress(name, here.lat, here.lng, controller.signal);
      setHits(found);
      if (found[0]) {
        onPick(found[0]);
        setNote(found[0].label);
      } else {
        setNote('그 주소를 찾지 못했습니다.');
      }
    } catch {
      setHits([]);
      setNote('주소를 찾지 못했습니다. 잠시 뒤 다시 시도하세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="map-search" data-map-search onSubmit={findAddress} onContextMenu={(event) => event.preventDefault()}>
      <label className="sr" htmlFor="map-address-query">
        주소
      </label>
      <input
        id="map-address-query"
        name="address"
        data-map-search-input
        value={query}
        placeholder="주소"
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      <button className="field-btn sea" type="submit" data-map-search-find disabled={busy}>
        찾기
      </button>
      {hits.length > 0 && (
        <div className="map-search-hits" data-map-search-hits>
          {hits.map((hit) => (
            <button key={hit.id} type="button" onClick={() => onPick(hit)}>
              {hit.label}
            </button>
          ))}
        </div>
      )}
      {note ? <p data-address-note>{note}</p> : null}
    </form>
  );
}

/** 해와 달을 지도 테두리의 실제 방위에 둡니다. 지평선 아래면 흐리게 적습니다. */
function MapRim({ rim, bearing, width, height }: { rim: SkyRim; bearing: number; width: number; height: number }) {
  const sun = rimPoint(rim.sun.azimuth, bearing, width, height, 20);
  let moon = rimPoint(rim.moon.azimuth, bearing, width, height, 20);
  if (Math.hypot(sun.x - moon.x, sun.y - moon.y) < 36) {
    moon = {
      x: width / 2 + (moon.x - width / 2) * 0.78,
      y: height / 2 + (moon.y - height / 2) * 0.78,
    };
  }
  const items = [
    { kind: 'sun' as const, name: '해', body: rim.sun, point: sun },
    { kind: 'moon' as const, name: '달', body: rim.moon, point: moon },
  ];
  return (
    <div className="map-rim" data-map-rim data-map-bearing={bearing.toFixed(1)}>
      {items.map((item) => {
        const set = item.body.altitude < 0;
        return (
          <span
            key={item.kind}
            data-rim={item.kind}
            data-azimuth={item.body.azimuth.toFixed(2)}
            data-altitude={item.body.altitude.toFixed(2)}
            data-set={set ? 'yes' : 'no'}
            style={{ left: item.point.x, top: item.point.y }}
          >
            <i className={item.kind === 'sun' ? 'rim-sun' : 'rim-moon'} />
            {item.name}
            {set ? ' 짐' : ''}
          </span>
        );
      })}
    </div>
  );
}

