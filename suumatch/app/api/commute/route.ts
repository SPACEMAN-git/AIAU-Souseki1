import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/api-cors";
import { hasExternalProvider, searchExternalProvider } from "@/lib/commute-provider";
import { findMatchingProperties } from "@/lib/property-search";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      destination?: string;
      maxMinutes?: number;
      destinationPlace?: {
        lat?: number;
        lng?: number;
        address?: string;
      };
      destinationStationId?: string;
      maxBudgetYen?: number;
    };
    const destination = body.destination?.trim() || "东京大学";
    const maxMinutes = Math.min(90, Math.max(10, Number(body.maxMinutes) || 35));
    const submittedMaxBudget = Number(body.maxBudgetYen);
    const maxBudgetYen = Number.isFinite(submittedMaxBudget)
      ? Math.min(500000, Math.max(45000, submittedMaxBudget))
      : 500000;
    const place = body.destinationPlace;
    const destinationPlace =
      place &&
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lng) &&
      Number(place.lat) >= 34 &&
      Number(place.lat) <= 37 &&
      Number(place.lng) >= 138 &&
      Number(place.lng) <= 141
        ? {
            lat: Number(place.lat),
            lng: Number(place.lng),
            address: place.address?.trim() || destination,
          }
        : undefined;

    if (!hasExternalProvider()) {
      return withCors(
        request,
        NextResponse.json(
          { error: "TravelTime 尚未配置。请先在 .env.local 中填写 TRAVELTIME_API_KEY。" },
          { status: 503 },
        ),
      );
    }

    const commuteResult = await searchExternalProvider({
      destination,
      maxMinutes,
      destinationPlace,
      destinationStationId: body.destinationStationId?.trim() || undefined,
    });
    const propertyResult = await findMatchingProperties(
      commuteResult.reachableStations,
      maxMinutes,
      maxBudgetYen,
    );

    return withCors(
      request,
      NextResponse.json({
        ...commuteResult,
        reachableStations: propertyResult.recommendedStations,
        properties: propertyResult.properties,
        propertySource: "supabase",
        note: commuteResult.selectedNearbyStationId
          ? `已按所选目的地入口站重新计算 · 仅展示同线路、有房源且满足门到门预算的 ${propertyResult.recommendedStations.length} 个车站 · 已预留 ${commuteResult.commuteBufferMinutes} 分钟缓冲`
          : `TravelTime 铁路实时计算 · 仅展示 ${propertyResult.recommendedStations.length} 个同时有房源且满足门到门预算的推荐站 · 已预留 ${commuteResult.commuteBufferMinutes} 分钟缓冲`,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法搜索通勤数据。";
    return withCors(
      request,
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
}
