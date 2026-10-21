import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxPublicToken } from './mapbox-token';

/** 아이폰에서 시뮬레이션을 실행한 뒤의 한 화면입니다. 지도 둘과 아래 프레임이 빈칸 없이 채웁니다. */
export function PhoneSim({
  photographer,
  subject,
  onBack,
  onFrameHost,
}: {
  photographer: { lat: number; lng: number };
  subject: { lat: number; lng: number };
  onBack: () => void;
  onFrameHost: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className="phone-sim" data-phone-sim>
      <button type="button" className="phone-sim-back" data-sim-back onClick={onBack}>
        설정
      </button>
      <div className="phone-sim-maps">
        <PairMap kind="plain" photographer={photographer} subject={subject} />
        <PairMap kind="elevation" photographer={photographer} subject={subject} />
      </div>
      <div className="phone-sim-frame" ref={onFrameHost} />
    </div>
  );
}

function PairMap({
  kind,
  photographer,
  subject,
}: {
  kind: 'plain' | 'elevation';
  photographer: { lat: number; lng: number };
  subject: { lat: number; lng: number };
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const pair = `${photographer.lat},${photographer.lng},${subject.lat},${subject.lng}`;

  useEffect(() => {
    const element = canvas.current;
    const token = mapboxPublicToken();
    if (!element || !token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      accessToken: token,
      container: element,
      style: kind === 'plain' ? 'mapbox://styles/mapbox/outdoors-v12' : emptyStyle(),
      center: [photographer.lng, photographer.lat],
      zoom: 11,
      attributionControl: true,
      interactive: false,
    });
    const markers: mapboxgl.Marker[] = [];
    const draw = () => {
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      markers.push(pin(map, photographer, 'author', '작가'));
      markers.push(pin(map, subject, 'subject', '대상'));
      const line = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [photographer.lng, photographer.lat],
            [subject.lng, subject.lat],
          ],
        },
      };
      const source = map.getSource('pair') as mapboxgl.GeoJSONSource | undefined;
      if (!source) map.addSource('pair', { type: 'geojson', data: line });
      else source.setData(line);
      if (!map.getLayer('pair-line')) {
        map.addLayer({
          id: 'pair-line',
          type: 'line',
          source: 'pair',
          paint: { 'line-color': '#14200a', 'line-width': 3 },
        });
      }
      const bounds = new mapboxgl.LngLatBounds([photographer.lng, photographer.lat], [subject.lng, subject.lat]);
      map.fitBounds(bounds, { padding: 28, maxZoom: 14.5, duration: 0 });
      element.dataset.simReady = 'yes';
    };
    const onLoad = () => {
      if (kind === 'elevation' && !map.getSource('dem')) {
        map.addSource('dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        map.addLayer({
          id: 'elevation',
          type: 'hillshade',
          source: 'dem',
          paint: {
            'hillshade-exaggeration': 0.85,
            'hillshade-shadow-color': '#2a2118',
            'hillshade-highlight-color': '#f7f4ee',
            'hillshade-accent-color': '#7d6a52',
          },
        });
      }
      draw();
    };
    map.on('load', onLoad);
    map.on('error', () => {
      /* 403 타일은 비워 둡니다. 높이를 짐작해 채우지 않습니다. */
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      markers.forEach((marker) => marker.remove());
      map.remove();
      delete element.dataset.simReady;
    };
  }, [kind, pair, photographer.lat, photographer.lng, subject.lat, subject.lng]);

  return (
    <section className="phone-sim-map" data-sim-map={kind} aria-label={kind === 'plain' ? '지도' : '고도'}>
      <div ref={canvas} className="phone-sim-canvas" data-sim-canvas />
      <span className="phone-sim-tag">{kind === 'plain' ? '지도' : '고도'}</span>
    </section>
  );
}

function emptyStyle(): mapboxgl.StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'empty', type: 'background', paint: { 'background-color': '#d9d3c7' } }],
  };
}

function pin(map: mapboxgl.Map, place: { lat: number; lng: number }, role: 'author' | 'subject', label: string): mapboxgl.Marker {
  const element = document.createElement('span');
  element.className = `map-pin ${role}`;
  element.dataset.sightPin = role;
  element.textContent = label.slice(0, 1);
  element.setAttribute('aria-label', label);
  return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(map);
}
