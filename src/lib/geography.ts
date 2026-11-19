import { countries, type Country } from '../data/countries';

export { countries };
export type { Country };

type Ring = number[][];
type Geography = { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] };
type CountryShape = { properties: { code: string; name: string }; geometry: Geography };
let shapes: CountryShape[] | null = null;

export function byCode(code: string): Country | undefined {
  return countries.find(country => country.code === code);
}

export async function loadCountryShapes(): Promise<void> {
  if (shapes) return;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}countries.geojson`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { features: CountryShape[] };
    shapes = data.features;
  } catch (error) {
    console.warn('Country geometry unavailable; manual country selection still works.', error);
    shapes = [];
  }
}

function insideRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function insidePolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !insideRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (insideRing(lng, lat, rings[i])) return false;
  return true;
}

/** Uses bundled simplified Natural Earth boundaries; never reads GPS or IP address. */
export function countryAt(lng: number, lat: number): Country | undefined {
  for (const feature of shapes ?? []) {
    const geometry = feature.geometry;
    const hit = geometry.type === 'Polygon'
      ? insidePolygon(lng, lat, geometry.coordinates as Ring[])
      : (geometry.coordinates as Ring[][]).some(polygon => insidePolygon(lng, lat, polygon));
    if (hit) {
      return byCode(feature.properties.code) ?? {
        code: feature.properties.code,
        name: feature.properties.name,
        lat,
        lng,
      };
    }
  }
  return undefined;
}

/** Intentionally coarse. Pins are approximate places, not someone's precise address. */
export function coarsePoint(lng: number, lat: number): { lng: number; lat: number } {
  return {
    lng: Math.max(-180, Math.min(180, Math.round(lng))),
    lat: Math.max(-85, Math.min(85, Math.round(lat))),
  };
}

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return [...code].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

export function relativeTime(value: string): string {
  const difference = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
