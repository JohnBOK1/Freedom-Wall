import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Post } from '../lib/data';
import { coarsePoint, countryAt, loadCountryShapes, type Country } from '../lib/geography';

export type MapActions = { zoomIn: () => void; zoomOut: () => void; reset: () => void; flyTo: (lng: number, lat: number, zoom?: number) => void };
export type MapLocation = { latitude: number; longitude: number; country?: Country };
type Props = {
  phase: 'intro' | 'transition' | 'explore';
  posts: Post[];
  selectedId: string | null;
  onSelectPost: (post: Post) => void;
  onSelectLocation: (location: MapLocation) => void;
};

// MapLibre 6 needs an explicit worker URL when bundled using Vite.
maplibregl.setWorkerUrl(workerUrl);

const mapStyle = 'https://tiles.openfreemap.org/styles/dark';

const GlobeMap = forwardRef<MapActions, Props>(function GlobeMap({ phase, posts, selectedId, onSelectPost, onSelectLocation }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const phaseRef = useRef(phase);
  const locationCallback = useRef(onSelectLocation);
  const postCallback = useRef(onSelectPost);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  phaseRef.current = phase;
  locationCallback.current = onSelectLocation;
  postCallback.current = onSelectPost;

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn({ duration: 550 }),
    zoomOut: () => mapRef.current?.zoomOut({ duration: 550 }),
    reset: () => mapRef.current?.flyTo({ center: [8, 17], zoom: 1.65, duration: 1400 }),
    flyTo: (lng, lat, zoom = 4.6) => mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1500, essential: true }),
  }), []);

  useEffect(() => {
    void loadCountryShapes();
    if (!containerRef.current) return;
let map: maplibregl.Map;

try {
  map = new maplibregl.Map({
    container: containerRef.current,
    style: mapStyle,
    center: [-12, 21],
    zoom: 1.42,
    minZoom: 1.15,
    maxZoom: 12,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    renderWorldCopies: true,
  });
}catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The map could not start.');
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('style.load', () => {
      map.setProjection({ type: phaseRef.current === 'explore' ? 'mercator' : 'globe' });
    });
    map.on('load', () => setLoaded(true));
    map.on('click', (event: maplibregl.MapMouseEvent) => {
      if (phaseRef.current !== 'explore') return;
      const point = coarsePoint(event.lngLat.lng, event.lngLat.lat);
      const country = countryAt(event.lngLat.lng, event.lngLat.lat);
      locationCallback.current({ latitude: point.lat, longitude: point.lng, country });
    });
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (phase === 'intro') {
      map.setProjection({ type: 'globe' });
      const drift = () => {
        if (!mapRef.current || phaseRef.current !== 'intro') return;
        const center = map.getCenter();
        map.easeTo({ center: [center.lng + 55, 21], duration: 26000, easing: (t: number) => t });
      };
      map.on('moveend', drift);
      drift();
      return () => { map.off('moveend', drift); map.stop(); };
    }
    if (phase === 'transition') { map.stop(); return; }
    map.setProjection({ type: 'mercator' });
    map.flyTo({ center: [8, 17], zoom: 1.65, duration: 1700, essential: true });
    window.setTimeout(() => map.resize(), 400);
  }, [phase, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (phase !== 'explore') return;
    for (const post of posts) {
      const element = document.createElement('button');
      const active = post.id === selectedId;
      element.type = 'button';
      element.className = `map-pin ${active ? 'map-pin-selected' : ''}`;
      element.setAttribute('aria-label', `View ${post.display_name}'s message from ${post.country_name}`);
      element.title = `${post.display_name} · ${post.country_name}`;
      element.innerHTML = `<span class="map-pin-halo"></span><span class="map-pin-core"></span>`;
      element.addEventListener('click', event => {
        event.stopPropagation();
        postCallback.current(post);
      });
      const marker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([post.longitude, post.latitude]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [posts, phase, selectedId, loaded]);

  return (
    <div className={`map-stage map-stage-${phase}`}>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive world map" />
      <div className="map-vignette" aria-hidden="true" />
      {!loaded && !error && <div className="map-loading"><span className="loader-ring" /> Mapping the world…</div>}
      {error && <div className="map-loading map-error">{error}</div>}
    </div>
  );
});

export default GlobeMap;
