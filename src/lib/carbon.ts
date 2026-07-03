// Shared, dependency-free helpers for measuring land area and carbon.
// Reused by the Measuring Area tool (and future Carbon Calculator).

export type Ecosystem = "mangrove" | "seaweed" | "forest" | "peatland";

export type LatLng = { lat: number; lng: number };

export const ECOSYSTEMS: Record<
  Ecosystem,
  { label: string; factor: number; emoji: string; banner: string; hex: string }
> = {
  forest: { label: "Forest", factor: 250, emoji: "🌲", banner: "bg-emerald-800", hex: "#14532d" },
  mangrove: { label: "Mangrove", factor: 150, emoji: "🌿", banner: "bg-teal-800", hex: "#115e59" },
  peatland: { label: "Peatland", factor: 200, emoji: "🟫", banner: "bg-amber-800", hex: "#78350f" },
  seaweed: { label: "Seaweed", factor: 5, emoji: "🪸", banner: "bg-sky-800", hex: "#075985" },
};

export const CO2E_RATIO = 3.67; // CO₂e = Carbon × 3.67
export const HA_PER_M2 = 1 / 10_000;

/**
 * Geodesic area of a polygon on the WGS84 sphere, in square metres.
 * Same spherical-excess method used by Leaflet.GeometryUtil — accurate
 * for real-world land parcels without any external library.
 */
export function geodesicAreaM2(points: LatLng[]): number {
  const n = points.length;
  if (n < 3) return 0;
  const R = 6378137; // Earth radius (m)
  const d2r = Math.PI / 180;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    area +=
      (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
  }
  return Math.abs((area * R * R) / 2);
}

export function areaHa(points: LatLng[]): number {
  return geodesicAreaM2(points) * HA_PER_M2;
}

export function centroid(points: LatLng[]): LatLng {
  const n = points.length || 1;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / n, lng: sum.lng / n };
}

export type CarbonResult = {
  areaHa: number;
  factor: number;
  carbonTon: number;
  co2eTon: number;
  credits: number; // 1 CCT = 1 ton CO₂e
};

export function computeCarbon(ecosystem: Ecosystem, ha: number): CarbonResult {
  const factor = ECOSYSTEMS[ecosystem].factor;
  const carbonTon = ha * factor;
  const co2eTon = carbonTon * CO2E_RATIO;
  return {
    areaHa: ha,
    factor,
    carbonTon,
    co2eTon,
    credits: co2eTon,
  };
}

/** Build a GeoJSON Polygon (lng,lat order, closed ring) for storage. */
export function toGeoJsonPolygon(points: LatLng[]) {
  const ring = points.map((p) => [p.lng, p.lat]);
  if (ring.length) ring.push(ring[0]); // close the ring
  return { type: "Polygon" as const, coordinates: [ring] };
}
