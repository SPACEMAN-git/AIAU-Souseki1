import { getSupabaseClient } from "./supabase";

export type TokyoStation = {
  id: string;
  stationKey: string;
  nameJa: string;
  nameZh: string;
  nameEn: string;
  lines: string[];
  latitude: number;
  longitude: number;
};

type StationRow = {
  id: string;
  station_key: string;
  name_ja: string;
  name_zh: string;
  name_en: string;
  lines: string[];
  latitude: number;
  longitude: number;
};

export async function getTokyoStations(): Promise<TokyoStation[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("stations")
    .select("id, station_key, name_ja, name_zh, name_en, lines, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(300);

  if (error) throw new Error(`Supabase station query failed: ${error.message}`);

  return ((data ?? []) as StationRow[]).map((station) => ({
    id: station.id,
    stationKey: station.station_key,
    nameJa: station.name_ja,
    nameZh: station.name_zh,
    nameEn: station.name_en,
    lines: station.lines,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
  }));
}
