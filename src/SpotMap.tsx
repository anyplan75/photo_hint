import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function SpotMap({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const element = container.current;
    if (!element || mapRef.current) return;
    const map = L.map(element, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([36.35, 127.8], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    map.on('click', (event) => {
      onPickRef.current(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const next = L.latLng(lat, lng);
    if (!map.getBounds().pad(-0.2).contains(next) || map.getZoom() < 13) {
      map.setView(next, 15);
    }
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(next, {
        radius: 8,
        color: '#2a2114',
        weight: 2,
        fillColor: '#e6b15a',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(next);
    }
  }, [lat, lng]);

  return <div ref={container} className="spot-map" role="application" aria-label="지도를 눌러 자리를 찍습니다" />;
}
