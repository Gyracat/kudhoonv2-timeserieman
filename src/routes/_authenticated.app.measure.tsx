import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Ruler,
  Pencil,
  Undo2,
  Check,
  Trash2,
  MapPin,
  Leaf,
  Sparkles,
  Info,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/landing/site-chrome";
import {
  ECOSYSTEMS,
  type Ecosystem,
  type LatLng,
  areaHa,
  centroid,
  computeCarbon,
  toGeoJsonPolygon,
} from "@/lib/carbon";
import {
  reverseGeocode,
  createMeasuredProject,
  type GeoResult,
} from "@/lib/measure.functions";

export const Route = createFileRoute("/_authenticated/app/measure")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Measure Land Area — CarbonMaps" },
      {
        name: "description",
        content:
          "Draw your land on the map to measure area with GIS precision and estimate carbon stock instantly.",
      },
    ],
  }),
  component: MeasurePage,
});

// A small demo parcel in Borneo so judges can see results in one click.
const DEMO_POLYGON: LatLng[] = [
  { lat: 0.62, lng: 114.02 },
  { lat: 0.68, lng: 114.14 },
  { lat: 0.58, lng: 114.22 },
  { lat: 0.5, lng: 114.13 },
  { lat: 0.53, lng: 114.03 },
];

function MeasurePage() {
  const geocode = useServerFn(reverseGeocode);
  const createProject = useServerFn(createMeasuredProject);

  const [points, setPoints] = useState<LatLng[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [ecosystem, setEcosystem] = useState<Ecosystem>("forest");
  const [name, setName] = useState("");
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const drawingRef = useRef(drawing);
  const finishedRef = useRef(finished);
  drawingRef.current = drawing;
  finishedRef.current = finished;

  const ha = useMemo(() => (points.length >= 3 ? areaHa(points) : 0), [points]);
  const result = useMemo(() => computeCarbon(ecosystem, ha), [ecosystem, ha]);

  // ---- init map (dynamic import, same pattern as /map) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, { scrollWheelZoom: true }).setView([0.58, 114.12], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: any) => {
        if (!drawingRef.current || finishedRef.current) return;
        const { lat, lng } = e.latlng;
        setPoints((prev) => [...prev, { lat, lng }]);
      });

      mapInstance.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // ---- redraw polygon + vertices whenever points change ----
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapInstance.current;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      if (points.length === 0) return;

      const group = L.layerGroup();
      const hex = ECOSYSTEMS[ecosystem].hex;

      if (points.length >= 2) {
        const shape =
          points.length >= 3 && finished
            ? L.polygon(points.map((p) => [p.lat, p.lng]), {
                color: hex,
                weight: 2,
                fillColor: hex,
                fillOpacity: 0.25,
              })
            : L.polyline(points.map((p) => [p.lat, p.lng]), {
                color: hex,
                weight: 2,
                dashArray: "6 5",
              });
        group.addLayer(shape);
      }

      points.forEach((p, i) => {
        const dot = L.divIcon({
          className: "",
          html: `<div style="width:11px;height:11px;border-radius:50%;background:#fff;border:3px solid ${hex};box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
          iconSize: [11, 11],
          iconAnchor: [5, 5],
        });
        group.addLayer(L.marker([p.lat, p.lng], { icon: dot, title: `Point ${i + 1}` }));
      });

      group.addTo(map);
      layerRef.current = group;
    })();
  }, [points, ready, ecosystem, finished]);

  // ---- reverse geocode once a polygon is finished ----
  useEffect(() => {
    if (!finished || points.length < 3) return;
    const c = centroid(points);
    setGeoLoading(true);
    geocode({ data: { lat: c.lat, lng: c.lng } })
      .then((g) => setGeo(g))
      .catch(() => setGeo(null))
      .finally(() => setGeoLoading(false));
  }, [finished]);

  function startDrawing() {
    reset();
    setDrawing(true);
    toast.info("Click on the map to drop points around your land");
  }
  function undo() {
    setPoints((prev) => prev.slice(0, -1));
    setFinished(false);
  }
  function finish() {
    if (points.length < 3) {
      toast.error("Add at least 3 points to close the area");
      return;
    }
    setDrawing(false);
    setFinished(true);
  }
  function reset() {
    setPoints([]);
    setDrawing(false);
    setFinished(false);
    setGeo(null);
    setCreated(null);
  }
  function loadDemo() {
    reset();
    setPoints(DEMO_POLYGON);
    setFinished(true);
    setEcosystem("forest");
    if (mapInstance.current) mapInstance.current.flyTo([0.58, 114.12], 10, { duration: 1 });
  }

  async function save() {
    if (!finished || points.length < 3) {
      toast.error("Finish drawing your land first");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Give your project a name");
      return;
    }
    setSaving(true);
    try {
      const c = centroid(points);
      const row = await createProject({
        data: {
          name: name.trim(),
          ecosystem,
          area_ha: result.areaHa,
          carbon_ton: result.carbonTon,
          co2e_ton: result.co2eTon,
          geojson: toGeoJsonPolygon(points),
          lat: c.lat,
          lng: c.lng,
          region: geo?.region ?? null,
          country: geo?.country ?? null,
        },
      });
      setCreated({ id: row.id, name: row.name });
      toast.success("Project created — ready for verification 🎉");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  const eco = ECOSYSTEMS[ecosystem];

  return (
    <div className="min-h-screen bg-naturebag">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <Ruler className="size-7 text-forest" /> Measure Land Area
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Draw your land on the map. We compute the exact area with GIS-grade geodesic math,
            auto-detect its location, and estimate carbon stock — the foundation for verification
            and certification.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ---------------- MAP + toolbar ---------------- */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {!drawing && !finished && (
                <button
                  onClick={startDrawing}
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-deep"
                >
                  <Pencil className="size-4" /> Start drawing
                </button>
              )}
              {drawing && (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-forest">
                    <span className="size-2 animate-pulse rounded-full bg-forest" /> Drawing · click the map
                  </span>
                  <button
                    onClick={undo}
                    disabled={points.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition hover:bg-naturebag disabled:opacity-50"
                  >
                    <Undo2 className="size-4" /> Undo
                  </button>
                  <button
                    onClick={finish}
                    className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    <Check className="size-4" /> Finish ({points.length})
                  </button>
                </>
              )}
              {(finished || points.length > 0) && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-naturebag"
                >
                  <Trash2 className="size-4" /> Clear
                </button>
              )}
              <button
                onClick={loadDemo}
                className="ml-auto inline-flex items-center gap-2 rounded-full border border-dashed border-forest/40 bg-white px-4 py-2 text-sm font-medium text-forest transition hover:bg-emerald-50"
              >
                <Wand2 className="size-4" /> Load demo parcel
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div ref={mapRef} style={{ height: "62vh", width: "100%" }} />
              {!ready && (
                <div className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              )}
            </div>

            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Area is computed with the WGS84 geodesic (spherical-excess) formula. Location lookup by{" "}
              <a className="underline" href="https://nominatim.org/" target="_blank" rel="noreferrer">
                Nominatim / OpenStreetMap
              </a>{" "}
              — free, no API key.
            </p>
          </div>

          {/* ---------------- results panel ---------------- */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* ecosystem picker */}
              <div className="rounded-2xl border border-border bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Ecosystem type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ECOSYSTEMS) as Ecosystem[]).map((k) => {
                    const active = ecosystem === k;
                    const m = ECOSYSTEMS[k];
                    return (
                      <button
                        key={k}
                        onClick={() => setEcosystem(k)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          active
                            ? "border-forest bg-forest text-white"
                            : "border-border bg-white hover:border-forest/40"
                        }`}
                      >
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-left leading-tight">
                          <span className="block font-medium">{m.label}</span>
                          <span className={`text-[11px] ${active ? "text-emerald-50/80" : "text-muted-foreground"}`}>
                            {m.factor} tC/ha
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* area + carbon */}
              <div className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Measured area</span>
                  <span className="text-xs text-muted-foreground">{points.length} points</span>
                </div>
                <div className="mt-1 text-4xl font-extrabold text-foreground">
                  {ha > 0 ? ha.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                  <span className="ml-1 text-lg font-semibold text-muted-foreground">ha</span>
                </div>
                {ha > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ≈ {(ha * 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat value={result.carbonTon} label="tC" tone="text-forest" show={ha > 0} />
                  <Stat value={result.co2eTon} label="t CO₂e" tone="text-sky" show={ha > 0} />
                  <Stat value={result.credits} label="CCT" tone="text-emerald-600" show={ha > 0} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Carbon = area × {eco.factor} tC/ha · CO₂e = carbon × 3.67 · 1 CCT = 1 t CO₂e
                </p>
              </div>

              {/* location */}
              {finished && (
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="size-4 text-forest" /> Detected location
                  </p>
                  {geoLoading ? (
                    <p className="mt-1 text-sm text-muted-foreground">Looking up…</p>
                  ) : geo && (geo.region || geo.country) ? (
                    <p className="mt-1 text-sm text-foreground">
                      {[geo.region, geo.country].filter(Boolean).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Remote / offshore area</p>
                  )}
                </div>
              )}

              {/* create project */}
              <div className="rounded-2xl border border-border bg-white p-4">
                {created ? (
                  <div className="text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="size-7 text-emerald-600" />
                    </div>
                    <p className="mt-3 font-semibold text-foreground">Project created!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      “{created.name}” is now a draft awaiting verification.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Link
                        to="/marketplace/$projectId"
                        params={{ projectId: created.id }}
                        className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-deep"
                      >
                        View project
                      </Link>
                      <button
                        onClick={reset}
                        className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-naturebag"
                      >
                        Measure another
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="text-sm font-semibold text-foreground">Project name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Borneo North Canopy"
                      className="mt-1 w-full rounded-xl border border-border bg-naturebag px-3 py-2.5 text-sm outline-none focus:border-forest"
                    />
                    <button
                      onClick={save}
                      disabled={!finished || saving}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-deep disabled:opacity-50"
                    >
                      <Leaf className="size-4" />
                      {saving ? "Creating…" : "Create project"}
                    </button>
                    {!finished && (
                      <p className="mt-2 flex items-center gap-1 text-center text-[11px] text-muted-foreground">
                        <Sparkles className="size-3" /> Draw & finish an area to enable
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
  show,
}: {
  value: number;
  label: string;
  tone: string;
  show: boolean;
}) {
  return (
    <div className="rounded-xl bg-naturebag py-2">
      <div className={`text-base font-bold ${tone}`}>
        {show ? Math.round(value).toLocaleString() : "—"}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
