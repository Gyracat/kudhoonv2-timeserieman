import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ECOSYSTEMS } from "@/lib/carbon";

/**
 * Reverse-geocode a coordinate to a human region + country using the
 * free OpenStreetMap Nominatim API (no API key required).
 * Docs: https://nominatim.org/release-docs/latest/api/Reverse/
 * We send a descriptive User-Agent as required by their usage policy.
 */
const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type GeoResult = { region: string | null; country: string | null; display: string | null };

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => geoSchema.parse(input))
  .handler(async ({ data }): Promise<GeoResult> => {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${data.lat}&lon=${data.lng}&zoom=8&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CarbonMaps/1.0 (hackathon demo; carbon land measurement)",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) return { region: null, country: null, display: null };
      const json: any = await res.json();
      const a = json?.address ?? {};
      const region =
        a.state || a.region || a.county || a.state_district || a.province || a.city || null;
      const country = a.country ?? null;
      return { region, country, display: json?.display_name ?? null };
    } catch {
      // Free service can rate-limit or be offline — fail soft.
      return { region: null, country: null, display: null };
    }
  });

/**
 * Persist a measured parcel as a new draft project owned by the user.
 * RLS requires auth.uid() = owner_id, satisfied by the auth middleware.
 */
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ecosystem: z.enum(["mangrove", "seaweed", "forest", "peatland"]),
  area_ha: z.number().positive().max(50_000_000),
  carbon_ton: z.number().nonnegative(),
  co2e_ton: z.number().nonnegative(),
  geojson: z.any(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  region: z.string().max(160).nullable().optional(),
  country: z.string().max(160).nullable().optional(),
  description: z.string().max(400).optional(),
});

export const createMeasuredProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const meta = ECOSYSTEMS[data.ecosystem];

    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description ?? `Measured via GIS polygon · ${data.area_ha.toFixed(2)} ha`,
        ecosystem: data.ecosystem,
        area_ha: data.area_ha,
        region: data.region ?? null,
        country: data.country ?? null,
        lat: data.lat,
        lng: data.lng,
        geojson: data.geojson,
        carbon_ton: data.carbon_ton,
        co2e_ton: data.co2e_ton,
        status: "draft",
        cover_emoji: meta.emoji,
        banner_color: meta.banner,
      })
      .select("id, name, ecosystem, area_ha, carbon_ton, co2e_ton, status, region, country")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
