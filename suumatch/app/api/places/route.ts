import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/api-cors";
import { hasExternalProvider } from "@/lib/commute-provider";
import { searchDestinationSuggestions } from "@/lib/place-search";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    if (!hasExternalProvider()) {
      return withCors(
        request,
        NextResponse.json(
          { error: "TravelTime 尚未配置。" },
          { status: 503 },
        ),
      );
    }

    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return withCors(request, NextResponse.json({ suggestions: [] }));
    }

    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const bias = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    const suggestions = await searchDestinationSuggestions(query, bias);
    return withCors(request, NextResponse.json({ suggestions }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "地点搜索失败。";
    return withCors(
      request,
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
