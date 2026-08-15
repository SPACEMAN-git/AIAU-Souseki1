"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  CommuteSearchResponse,
  NearbyStation,
  PlaceSuggestion,
  ReachableStation,
} from "@/lib/commute-types";
import HousingDnaTest from "@/app/components/housing-dna-test";
import { HOUSING_CALIBRATION_PROPERTIES } from "@/lib/housing-calibration";
import { PAGE_COPY, type Locale } from "@/lib/i18n";
import {
  getLineColor,
  getLineShortName,
  getLineStationOrder,
} from "@/lib/tokyo-line-order";
import {
  DEFAULT_HBTI_ANSWERS,
  deriveHbtiProfile,
  rankProperties,
  scoreProperties,
} from "@/lib/housing-scoring";
import type {
  HousingPreferenceKey,
  PreferenceProfile,
  RankingMode,
  ScoredProperty,
} from "@/lib/housing-scoring";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const initialResult: CommuteSearchResponse = {
  destination: { name: "东京大学", subtitle: "本乡校区 · 文京区", lat: 35.7126, lng: 139.7619 },
  requestedMinutes: 35,
  candidateStationCount: 0,
  commuteBufferMinutes: 3,
  nearbyStations: [
    { id: "todaimae", name: "东大前", nameJa: "東大前", lines: ["东京Metro南北线"], walkingMinutes: 4, accent: "#48a999" },
    { id: "hongosanchome", name: "本乡三丁目", nameJa: "本郷三丁目", lines: ["东京Metro丸之内线", "都营大江户线"], walkingMinutes: 11, accent: "#e95d55" },
    { id: "nezu", name: "根津", nameJa: "根津", lines: ["东京Metro千代田线"], walkingMinutes: 14, accent: "#34a56f" },
  ],
  reachableStations: [],
  properties: [],
  propertySource: "unavailable",
  generatedAt: "",
  source: "demo",
};

type RailGroup = {
  line: string;
  shortName: string;
  color: string;
  nodes: Array<{
    nameJa: string;
    station?: ReachableStation;
  }>;
};

function buildRailGroups(
  stations: ReachableStation[],
  allowedLines?: string[],
): RailGroup[] {
  const stationsByLine = new Map<string, ReachableStation[]>();
  for (const station of stations) {
    for (const line of station.lines) {
      if (allowedLines && !allowedLines.includes(line)) continue;
      const lineStations = stationsByLine.get(line) ?? [];
      if (!lineStations.some((candidate) => candidate.id === station.id)) {
        lineStations.push(station);
      }
      stationsByLine.set(line, lineStations);
    }
  }

  return [...stationsByLine.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ja"))
    .slice(0, 6)
    .map(([line, lineStations]) => {
      const fullOrder = getLineStationOrder(line);
      const stationByName = new Map(lineStations.map((station) => [station.nameJa, station]));
      const knownIndexes = lineStations
        .map((station) => fullOrder.indexOf(station.nameJa))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);

      let contextNames: string[];
      if (knownIndexes.length >= 2) {
        const first = Math.max(0, knownIndexes[0] - 1);
        const last = Math.min(fullOrder.length, knownIndexes[knownIndexes.length - 1] + 2);
        const span = last - first;
        contextNames = span <= 8
          ? fullOrder.slice(first, last)
          : knownIndexes.map((index) => fullOrder[index]);
      } else if (knownIndexes.length === 1) {
        const stationIndex = knownIndexes[0];
        contextNames = fullOrder.slice(
          Math.max(0, stationIndex - 1),
          Math.min(fullOrder.length, stationIndex + 2),
        );
      } else {
        contextNames = [...lineStations]
          .sort((a, b) => a.bestDoorToDoorMinutes - b.bestDoorToDoorMinutes)
          .map((station) => station.nameJa);
      }

      return {
        line,
        shortName: getLineShortName(line),
        color: getLineColor(line),
        nodes: contextNames.map((nameJa) => ({
          nameJa,
          station: stationByName.get(nameJa),
        })),
      };
    });
}

function formatDistance(distanceMeters?: number) {
  if (distanceMeters == null) return "";
  if (distanceMeters < 1000) return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function getOsmEmbedUrl(place: PlaceSuggestion) {
  const lngDelta = 0.008;
  const latDelta = 0.006;
  const bbox = [
    place.lng - lngDelta,
    place.lat - latDelta,
    place.lng + lngDelta,
    place.lat + latDelta,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${place.lat}%2C${place.lng}`;
}

function Icon({ name, size = 20 }: { name: "pin" | "clock" | "train" | "walk" | "arrow" | "search" | "spark"; size?: number }) {
  const paths = {
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    train: <><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 21l2-3m6 0 2 3M8 8h8M8 13h.01M16 13h.01"/></>,
    walk: <><circle cx="13" cy="4" r="2"/><path d="m10 22 1-7-3-2 2-6 5 3 3 1M11 15l5 7"/></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    spark: <><path d="m12 3 1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9L12 3Z"/><path d="m5 14 .7 2.3L8 17.5l-2.3 1.2L5 21l-.7-2.3L2 17.5l2.3-1.2L5 14Z"/></>,
  };

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function localizeReason(reason: string, locale: Locale) {
  if (locale === "zh") return reason;
  const translations: Record<string, [string, string]> = {
    "通勤优秀": ["通勤が優秀", "Excellent commute"], "通勤符合预算": ["通勤条件に合う", "Commute fits"],
    "性价比高": ["コスパが高い", "Great value"], "总月费可接受": ["月額が適正", "Affordable monthly cost"],
    "房屋条件匹配": ["住まい条件に合う", "Housing fit"], "房屋条件较均衡": ["条件のバランスが良い", "Balanced home"],
    "离车站近": ["駅に近い", "Close to station"], "到站距离可接受": ["駅徒歩が許容範囲", "Manageable station walk"],
    "生活便利 Demo 表现好": ["生活利便性 Demo が良好", "Strong demo amenities"], "生活数据为 Demo": ["生活データは Demo", "Demo amenity data"],
  };
  return translations[reason]?.[locale === "ja" ? 0 : 1] ?? reason;
}

function getWhyMatched(property: ScoredProperty, profile: PreferenceProfile, locale: Locale, destination: string) {
  const priorities = (Object.keys(profile.weights) as HousingPreferenceKey[])
    .sort((left, right) => profile.weights[right] - profile.weights[left]);
  const detail: Record<Locale, Record<HousingPreferenceKey, [string, string]>> = {
    zh: {
      commute: ["💚 你很重视通勤", `→ 到 ${destination} 门到门只需 ${property.commute.finalMinutes} 分钟`],
      price: ["💚 你希望控制每月支出", `→ 房租与管理费合计 ¥${(property.monthlyRentYen + property.managementFeeYen).toLocaleString()}`],
      housing: ["💚 你重视房间的舒适度", `→ ${property.layout} · ${property.areaSqm}㎡ · 築${property.buildingAgeYears}年`],
      station: ["💚 你希望轻松到达车站", `→ ${property.station.name}站步行 ${property.station.walkingMinutes} 分钟`],
      lifestyle: ["💚 你重视周边生活", `→ 10 分钟内有 ${property.lifestyle?.supermarketsWithin10Minutes ?? 0} 家超市和 ${property.lifestyle?.restaurantsWithin10Minutes ?? 0} 家餐厅（Demo）`],
    },
    ja: {
      commute: ["💚 通勤を重視しています", `→ ${destination} までドアツードア ${property.commute.finalMinutes}分`],
      price: ["💚 毎月の費用を重視しています", `→ 家賃・管理費合計 ¥${(property.monthlyRentYen + property.managementFeeYen).toLocaleString()}`],
      housing: ["💚 部屋の快適さを重視しています", `→ ${property.layout} · ${property.areaSqm}㎡ · 築${property.buildingAgeYears}年`],
      station: ["💚 駅までの移動を重視しています", `→ ${property.station.nameJa}駅 徒歩${property.station.walkingMinutes}分`],
      lifestyle: ["💚 周辺の暮らしを重視しています", `→ 徒歩10分内にスーパー${property.lifestyle?.supermarketsWithin10Minutes ?? 0}件・飲食店${property.lifestyle?.restaurantsWithin10Minutes ?? 0}件（Demo）`],
    },
    en: {
      commute: ["💚 You care about commute", `→ Only ${property.commute.finalMinutes} min door to door to ${destination}`],
      price: ["💚 You care about monthly cost", `→ ¥${(property.monthlyRentYen + property.managementFeeYen).toLocaleString()} including management fee`],
      housing: ["💚 You value room comfort", `→ ${property.layout} · ${property.areaSqm}㎡ · ${property.buildingAgeYears} years old`],
      station: ["💚 You value easy station access", `→ ${property.station.walkingMinutes}-min walk to ${property.station.nameJa}`],
      lifestyle: ["💚 You value neighborhood life", `→ ${property.lifestyle?.supermarketsWithin10Minutes ?? 0} markets and ${property.lifestyle?.restaurantsWithin10Minutes ?? 0} restaurants within 10 min (Demo)`],
    },
  };
  const rows = priorities.slice(0, 2).map((key) => detail[locale][key]);
  if (property.buildingAgeYears > profile.targets.maxBuildingAgeYears) {
    rows.push(locale === "zh"
      ? ["⚠️ 你偏爱更新的房子", `→ 这套房築${property.buildingAgeYears}年`]
      : locale === "ja"
        ? ["⚠️ より新しい部屋が好みです", `→ この物件は築${property.buildingAgeYears}年`]
        : ["⚠️ You prefer newer homes", `→ This home is ${property.buildingAgeYears} years old`]);
  }
  return rows;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [destination, setDestination] = useState("东京大学");
  const [maxMinutes, setMaxMinutes] = useState(35);
  const [result, setResult] = useState<CommuteSearchResponse>(initialResult);
  const [selected, setSelected] = useState<ReachableStation | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPlaceMap, setShowPlaceMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accessStationLoadingId, setAccessStationLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [locationBias, setLocationBias] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile>(() =>
    deriveHbtiProfile({ ...DEFAULT_HBTI_ANSWERS }, HOUSING_CALIBRATION_PROPERTIES),
  );
  const [dnaApplied, setDnaApplied] = useState(false);
  const [rankingMode, setRankingMode] = useState<RankingMode>("for-you");
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const copy = PAGE_COPY[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem("commute-locale") as Locale | null;
    const detected = navigator.language.startsWith("ja") ? "ja" : navigator.language.startsWith("zh") ? "zh" : "en";
    setLocale(saved && ["zh", "ja", "en"].includes(saved) ? saved : detected);
  }, []);

  function changeLocale(next: Locale) {
    setLocale(next);
    window.localStorage.setItem("commute-locale", next);
  }

  const selectedDestinationStation = useMemo(
    () => result.nearbyStations.find(
      (station) => station.id === result.selectedNearbyStationId,
    ) ?? null,
    [result.nearbyStations, result.selectedNearbyStationId],
  );
  const lineCount = useMemo(
    () => selectedDestinationStation
      ? selectedDestinationStation.lines.length
      : new Set(result.reachableStations.flatMap((station) => station.lines)).size,
    [result.reachableStations, selectedDestinationStation],
  );
  const railGroups = useMemo(
    () => buildRailGroups(
      result.reachableStations,
      selectedDestinationStation?.lines,
    ),
    [result.reachableStations, selectedDestinationStation],
  );
  const scoredProperties = useMemo(
    () => scoreProperties(
      result.properties,
      result.reachableStations,
      preferenceProfile,
    ),
    [preferenceProfile, result.properties, result.reachableStations],
  );
  const rankedProperties = useMemo(
    () => rankProperties(scoredProperties, rankingMode),
    [rankingMode, scoredProperties],
  );
  const visibleProperties = useMemo(
    () => selected
      ? rankedProperties.filter((property) => property.station.key === selected.id)
      : rankedProperties,
    [rankedProperties, selected],
  );

  useEffect(() => {
    const query = destination.trim();
    if (query.length < 2 || selectedPlace?.name === query) {
      setPlaceSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const biasParams = locationBias ? `&lat=${locationBias.lat}&lng=${locationBias.lng}` : "";
        const response = await fetch(apiUrl(`/api/places?q=${encodeURIComponent(query)}${biasParams}`), {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || copy.exactRequired);
        setPlaceSuggestions(data.suggestions ?? []);
        setShowSuggestions(true);
      } catch (suggestionError) {
        if (!(suggestionError instanceof DOMException && suggestionError.name === "AbortError")) {
          setPlaceSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 550);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [copy.exactRequired, destination, locationBias, selectedPlace]);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationBias({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationLoading(false);
        setShowSuggestions(true);
      },
      () => {
        setLocationLoading(false);
        setError(locale === "ja" ? "現在地を取得できませんでした。" : locale === "en" ? "Could not access your location." : "无法获取当前位置。");
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  }

  function choosePlace(place: PlaceSuggestion) {
    setDestination(place.name);
    setSelectedPlace(place);
    setPlaceSuggestions([]);
    setShowSuggestions(false);
    setShowPlaceMap(false);
  }

  function chooseStation(station: ReachableStation) {
    setSelected(station);
    setExpandedPropertyId(null);
    window.setTimeout(() => {
      document.getElementById("property-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function completeHousingDna(profile: PreferenceProfile) {
    setPreferenceProfile(profile);
    setDnaApplied(true);
    setRankingMode("for-you");
    setExpandedPropertyId(null);
  }

  function continueAfterHousingDna() {
    window.setTimeout(() => {
      document.getElementById(result.reachableStations.length > 0 ? "property-results" : "top")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  async function requestCommute(
    destinationStationId?: string,
    placeOverride?: PlaceSuggestion,
    destinationOverride?: string,
  ) {
    const requestPlace = placeOverride ?? selectedPlace;
    const response = await fetch(apiUrl("/api/commute"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: destinationOverride ?? destination,
        maxMinutes,
        destinationStationId,
        destinationPlace: requestPlace
          ? {
              lat: requestPlace.lat,
              lng: requestPlace.lng,
              address: requestPlace.address,
            }
          : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "搜索失败");
    return data as CommuteSearchResponse;
  }

  async function chooseDestinationStation(station: NearbyStation) {
    if (accessStationLoadingId) return;
    setAccessStationLoadingId(station.id);
    setError("");
    setSelected(null);
    setExpandedPropertyId(null);

    try {
      const data = await requestCommute(station.id);
      setResult(data);
      window.setTimeout(() => {
        document.getElementById("commute-lines")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
    } catch (stationError) {
      setError(stationError instanceof Error ? stationError.message : "入口站计算失败，请重试。");
    } finally {
      setAccessStationLoadingId(null);
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSelected(null);
    setExpandedPropertyId(null);
    setShowSuggestions(false);
    setShowPlaceMap(false);

    try {
      let requestPlace = selectedPlace;
      let requestDestination = destination.trim();
      if (!requestPlace || requestPlace.name !== requestDestination) {
        const biasParams = locationBias ? `&lat=${locationBias.lat}&lng=${locationBias.lng}` : "";
        const placeResponse = await fetch(apiUrl(`/api/places?q=${encodeURIComponent(requestDestination)}${biasParams}`));
        const placeData = await placeResponse.json();
        requestPlace = placeData.suggestions?.[0] ?? null;
        if (!placeResponse.ok || !requestPlace) throw new Error(placeData.error || copy.exactRequired);
        requestDestination = requestPlace.name;
        setSelectedPlace(requestPlace);
        setDestination(requestDestination);
      }
      const data = await requestCommute(undefined, requestPlace, requestDestination);
      setResult(data);
      window.setTimeout(() => document.getElementById(dnaApplied ? "property-results" : "housing-dna")?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "搜索失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="Tokyo Commute Finder 首页">
          <span className="brand-mark"><Icon name="train" size={22} /></span>
          <span>よりみち</span>
          <small>COMMUTE FINDER</small>
        </a>
        <div className="nav-meta">
          <div className="language-switch" aria-label="Language">
            {(["zh", "ja", "en"] as Locale[]).map((item) => <button type="button" className={locale === item ? "active" : ""} onClick={() => changeLocale(item)} key={item}>{item === "zh" ? "中" : item === "ja" ? "日" : "EN"}</button>)}
          </div>
          <span className={`source-badge ${result.source}`}><i />{result.source === "api" ? copy.liveApi : copy.demo}</span>
          <span className="city-pill">TOKYO · 東京</span>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Icon name="spark" size={16} /> {copy.eyebrow}</div>
          <h1>{copy.heroTitle}<br/><em>{copy.heroAccent}</em></h1>
          <p>{copy.heroBody}</p>
        </div>

        <form className="search-panel" onSubmit={handleSearch}>
          <div className="parallel-feature-label hero-tool-label"><span>01</span><div><strong>{copy.tool1}</strong><small>{copy.tool1Hint}</small></div></div>
          <label className="destination-label">
            <span>{copy.destination}</span>
            <div
              className="destination-search"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setShowSuggestions(false);
                }
              }}
            >
              <div className="field">
                <Icon name="pin" />
                <input
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setSelectedPlace(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={copy.destinationPlaceholder}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions}
                  required
                />
                {suggestionsLoading && <span className="suggestion-spinner" aria-label="正在搜索地点" />}
              </div>
              <button type="button" className={`location-bias-button ${locationBias ? "active" : ""}`} onClick={useCurrentLocation} disabled={locationLoading}>{locationLoading ? copy.locating : locationBias ? `✓ ${copy.useLocation}` : copy.useLocation}</button>
              {showSuggestions && (placeSuggestions.length > 0 || suggestionsLoading) && (
                <div className="place-suggestions" role="listbox">
                  <div className="suggestion-heading">
                    <span>{copy.chooseExact}</span>
                    <small>{copy.addressPoi}</small>
                  </div>
                  {placeSuggestions.map((place) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedPlace?.id === place.id}
                      key={place.id}
                      onClick={() => choosePlace(place)}
                    >
                      <span className="suggestion-marker">
                        <span className="suggestion-icon"><Icon name="pin" size={16} /></span>
                        <small>{formatDistance(place.distanceMeters)}</small>
                      </span>
                      <span className="suggestion-copy">
                        <strong>{place.name}</strong>
                        <small>{place.address}</small>
                      </span>
                      <span className="suggestion-meta">
                        <span className="suggestion-category">{place.category}</span>
                        <b>↖</b>
                      </span>
                    </button>
                  ))}
                  <div className="suggestion-source">{copy.suggestionSource}</div>
                </div>
              )}
              {selectedPlace && (
                <>
                  <div className="selected-place">
                    <Icon name="pin" size={14} />
                    <span><strong>{copy.selectedExact}</strong>{selectedPlace.address}</span>
                    <span className="selected-place-actions">
                      <button type="button" onClick={() => setShowPlaceMap((visible) => !visible)}>{showPlaceMap ? copy.mapClose : copy.mapConfirm}</button>
                      <button type="button" onClick={() => {
                        setSelectedPlace(null);
                        setShowPlaceMap(false);
                        setShowSuggestions(true);
                      }}>{copy.change}</button>
                    </span>
                  </div>
                  {showPlaceMap && (
                    <div className="selected-map-preview">
                      <iframe
                        title={`${selectedPlace.name} 地图位置`}
                        src={getOsmEmbedUrl(selectedPlace)}
                        loading="lazy"
                      />
                      <span>{selectedPlace.lat.toFixed(5)}, {selectedPlace.lng.toFixed(5)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </label>
          <label>
            <span>{copy.maxCommute}</span>
            <div className="field time-field">
              <Icon name="clock" />
              <input type="number" min="10" max="90" value={maxMinutes} onChange={(event) => setMaxMinutes(Number(event.target.value))} />
              <b>{copy.withinMinutes}</b>
            </div>
          </label>
          <button type="submit" disabled={loading}>
            <Icon name="search" />{loading ? copy.searching : copy.search}
          </button>
          <p className="form-hint">{copy.formHint}</p>
        </form>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <div className="standalone-dna-shell">
        <div className="parallel-feature-label"><span>02</span><div><strong>{copy.tool2}</strong><small>{copy.tool2Hint}</small></div></div>
        <HousingDnaTest
          locale={locale}
          hasSearchResults={result.reachableStations.length > 0}
          onComplete={completeHousingDna}
          onRestart={() => setDnaApplied(false)}
          onContinue={continueAfterHousingDna}
        />
      </div>

      {result.reachableStations.length > 0 && (
        <section className="results-shell">
          <header className="result-heading">
            <div>
              <span className="section-kicker">{copy.searchResult}</span>
              <h2>{result.destination.name} · {result.requestedMinutes} {copy.minutes}</h2>
              <p>{result.destination.subtitle}</p>
            </div>
            <div className="summary-stats">
              <div><strong>{result.reachableStations.length}</strong><span>{copy.recommendedStations}</span></div>
              <div><strong>{result.properties.length}</strong><span>{copy.matchingHomes}</span></div>
              <div><strong>{lineCount}</strong><span>{copy.coveredLines}</span></div>
              <div><strong>{result.reachableStations[0]?.bestDoorToDoorMinutes}</strong><span>{copy.fastest}</span></div>
            </div>
          </header>

          {result.note && <div className="demo-note"><Icon name="spark" size={16}/>{locale === "zh" ? result.note : locale === "ja" ? "TravelTime によるリアルタイム計算 · 平日9:00到着想定" : "Live TravelTime calculation · weekday 9:00 arrival"}</div>}

          <div className="content-grid">
            <section className="nearby-card">
              <div className="card-heading">
                <div><span className="section-kicker">DESTINATION ACCESS</span><h3>{copy.destinationAccess}</h3></div>
                <span className="mini-pin"><Icon name="pin" size={18}/></span>
              </div>
              <div className="destination-node">
                <div className="destination-icon">大</div>
                <div><strong>{result.destination.name}</strong><span>{result.destination.subtitle}</span></div>
              </div>
              <div className="nearby-list">
                {result.nearbyStations.map((station) => (
                  <button
                    type="button"
                    key={station.id}
                    className={`nearby-station ${result.selectedNearbyStationId === station.id ? "active" : ""}`}
                    onClick={() => chooseDestinationStation(station)}
                    disabled={accessStationLoadingId !== null}
                    aria-pressed={result.selectedNearbyStationId === station.id}
                  >
                    <i style={{ background: station.accent }} />
                    <div className="station-copy"><strong>{locale === "zh" ? station.name : station.nameJa}</strong><small>{locale === "zh" ? station.nameJa : station.name}</small><span>{station.lines.join(" · ")}</span></div>
                    <div className="walk-time"><Icon name="walk" size={18}/><strong>{station.walkingMinutes}</strong><span>min</span></div>
                    <b className="access-action">{accessStationLoadingId === station.id ? copy.calculating : result.selectedNearbyStationId === station.id ? copy.chosen : copy.choose}</b>
                  </button>
                ))}
              </div>
              <p className="walking-note"><Icon name="walk" size={15}/> {copy.accessNote}</p>
            </section>

            <section className="commute-map-card" id="commute-lines">
              <div className="card-heading">
                <div><span className="section-kicker">{copy.commuteLines}</span><h3>{selectedDestinationStation ? `${selectedDestinationStation.name}` : copy.chooseAccess}</h3></div>
                <span className="map-legend"><i/> {copy.selectable}</span>
              </div>
              <p className="line-map-intro">{selectedDestinationStation
                ? locale === "zh" ? `按 ${selectedDestinationStation.lines.join(" · ")} 筛选，铁路、两端步行都计入预算。` : locale === "ja" ? `${selectedDestinationStation.lines.join(" · ")} 沿線で、電車と両端の徒歩をすべて通勤時間に含めます。` : `Filtered to ${selectedDestinationStation.lines.join(" · ")}; rail and both walking segments count toward the limit.`
                : copy.accessEmpty}</p>
              {selectedDestinationStation ? <div className="rail-map">
                {railGroups.map((group) => (
                  <article
                    className="rail-line"
                    key={group.line}
                    style={{ "--rail-color": group.color } as CSSProperties}
                  >
                    <header>
                      <i />
                      <div><strong>{group.shortName}</strong><small>{group.line}</small></div>
                    </header>
                    <div className="rail-stations">
                      <span className="rail-more">•••</span>
                      {group.nodes.map((node, index) => node.station ? (
                        <button
                          type="button"
                          key={`${group.line}:${node.nameJa}`}
                          className={`rail-station selectable ${selected?.id === node.station.id ? "active" : ""}`}
                          onClick={() => chooseStation(node.station!)}
                        >
                          <i />
                          <strong>{locale === "zh" ? node.station.name : node.station.nameJa}</strong>
                          <small>{node.station.bestDoorToDoorMinutes} min · {node.station.propertyCount} {locale === "zh" ? "套" : locale === "ja" ? "件" : "homes"}</small>
                        </button>
                      ) : (
                        <span className="rail-station context" key={`${group.line}:${node.nameJa}:${index}`}>
                          <i />
                          <strong>{node.nameJa}</strong>
                          <small>{locale === "zh" ? "沿线站" : locale === "ja" ? "沿線駅" : "line station"}</small>
                        </span>
                      ))}
                      <span className="rail-more">•••</span>
                    </div>
                  </article>
                ))}
              </div> : (
                <div className="access-station-empty">
                  <Icon name="train" size={22}/>
                  <span>{copy.accessEmpty}</span>
                </div>
              )}
              <div className={`route-detail ${selected ? "visible" : ""}`}>
                {selected ? <>
                  <div><span>{copy.stationOptions}</span><strong>{selected.name} <small>{selected.nameJa}</small></strong></div>
                  <Icon name="arrow" />
                  <div className="route-copy"><span>{selected.route}</span><strong>{copy.walk} {selected.bestPropertyWalkMinutes} {copy.minutes} + rail {selected.totalMinutes} {copy.minutes} = {selected.bestDoorToDoorMinutes} {copy.minutes}</strong></div>
                </> : <span>{copy.selectable}</span>}
              </div>
            </section>
          </div>

          <section className="station-results">
            <div className="list-heading">
              <div><span className="section-kicker">{copy.stationOptions}</span><h3>{copy.priorityStations}</h3></div>
              <span>{copy.stationSort}</span>
            </div>
            <div className="station-table">
              {result.reachableStations.map((station, index) => (
                <button type="button" key={station.id} className="station-row" onClick={() => chooseStation(station)}>
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="row-station"><strong>{locale === "zh" ? station.name : station.nameJa}</strong><small>{locale === "zh" ? station.nameJa : station.name}</small></span>
                  <span className="line-tags">{station.lines.slice(0, 2).map((line) => <i key={line}>{line}</i>)}{station.nearestMajorHub && <i className="hub-access-tag">{locale === "zh" ? "距" : locale === "ja" ? "最寄" : "near"} {station.nearestMajorHub} {station.majorHubDistanceKm}km</i>}</span>
                  <span className="route-summary"><small>{copy.walk} {station.bestPropertyWalkMinutes} {copy.minutes} · {station.totalMinutes} {copy.minutes}</small><strong>{copy.transfers} {station.transfers}</strong></span>
                  <span className="rent-hint">{station.propertyCount} {locale === "zh" ? "套 Demo 房源" : locale === "ja" ? "件のDemo物件" : "demo homes"}</span>
                  <span className="total-time"><strong>{station.bestDoorToDoorMinutes}</strong><small>min</small><Icon name="arrow" size={17}/></span>
                </button>
              ))}
            </div>
          </section>

          <section className="property-results" id="property-results">
            <div className="list-heading property-heading">
              <div><span className="section-kicker">ROOMANCE · ROOM + ROMANCE</span><h3>Your Best Matches</h3></div>
              {selected ? (
                <span className="property-station-filter">
                  <i /> {selected.name} · {visibleProperties.length}
                  <button type="button" onClick={() => setSelected(null)}>{copy.allHomes}</button>
                </span>
              ) : (
                <span className="database-badge"><i /> {visibleProperties.length} · {copy.supabaseConnected}</span>
              )}
            </div>
            <p className="property-explainer"><strong>Find a room worth falling for.</strong> {copy.rankingHint}</p>
            {!dnaApplied ? <div className="ranking-locked">
              <Icon name="spark" size={24}/><div><strong>{copy.lockedTitle}</strong><span>{copy.lockedBody}</span></div><button type="button" onClick={() => document.getElementById("housing-dna")?.scrollIntoView({ behavior: "smooth" })}>{copy.startDna}</button>
            </div> : <>
              <div className="ranking-tabs" role="tablist" aria-label="房源排序方式">
                <button type="button" role="tab" aria-selected={rankingMode === "for-you"} className={rankingMode === "for-you" ? "active" : ""} onClick={() => setRankingMode("for-you")}>
                  <strong>🏆 For You</strong><span>{copy.forYou}</span>
                </button>
                <button type="button" role="tab" aria-selected={rankingMode === "value"} className={rankingMode === "value" ? "active" : ""} onClick={() => setRankingMode("value")}>
                  <strong>💰 Best Value</strong><span>{copy.bestValue}</span>
                </button>
              </div>
              <p className="ranking-formula">{rankingMode === "for-you" ? copy.forYou : rankingMode === "value" ? copy.bestValue : copy.bestCommute}</p>
            {visibleProperties.length > 0 ? (
              <div className="property-grid">
                {visibleProperties.map((property, index) => {
                  const displayedScore = rankingMode === "value"
                    ? property.valueScore
                    : rankingMode === "commute"
                      ? property.scores.commute
                      : property.finalScore;
                  const expanded = expandedPropertyId === property.id;
                  const routeStation = result.reachableStations.find((station) => station.id === property.station.key);
                  const railMinutes = routeStation?.transitMinutes ?? Math.max(0, property.commute.stationToDestinationMinutes - (selectedDestinationStation?.walkingMinutes ?? 0));
                  const destinationWalkMinutes = routeStation?.walkingMinutes ?? selectedDestinationStation?.walkingMinutes ?? 0;
                  return (
                  <article className="property-card scored" key={property.id}>
                    <div className="property-image">
                      {property.imageUrl ? <img src={`${property.imageUrl}?auto=format&fit=crop&w=900&q=78`} alt={property.title} loading="lazy" /> : <span>DEMO PROPERTY</span>}
                      <b>MOCK / DEMO</b>
                    </div>
                    <div className="property-body">
                      <div className="property-price-score">
                        <em>¥{property.monthlyRentYen.toLocaleString()}<small>/{locale === "zh" ? "月" : locale === "ja" ? "月" : "mo"}</small></em>
                        <strong>{displayedScore}<small>% Match {index === 0 ? "🏆" : ""}</small></strong>
                      </div>
                      <div className="property-title"><div><strong>{property.title}</strong><span>{property.address}</span></div></div>
                      <div className="property-specs"><span>{property.layout}</span><span>{property.areaSqm}㎡</span><span>{locale === "en" ? `${property.buildingAgeYears} years old` : `築${property.buildingAgeYears}年`}</span><span>{property.floor}F</span></div>
                      <div className="listing-essentials">
                        <span><Icon name="walk" size={16}/>{locale === "zh" ? property.station.name : property.station.nameJa} · {copy.walk} {property.station.walkingMinutes} {copy.minutes}</span>
                        <span><Icon name="train" size={16}/>{result.destination.name} {property.commute.finalMinutes} {copy.minutes} · {copy.transfers} {property.transferCount}</span>
                      </div>
                      <div className="commute-segments" aria-label="三段通勤时间">
                        <div><small>{locale === "zh" ? "家" : locale === "ja" ? "自宅" : "Home"} → {property.station.name}</small><strong>{property.commute.propertyWalkMinutes}<i>{copy.minutes}</i></strong><span>{copy.walk}</span></div>
                        <b>+</b>
                        <div><small>{property.station.name} → {locale === "zh" ? "目的地站" : locale === "ja" ? "到着駅" : "Arrival station"}</small><strong>{railMinutes}<i>{copy.minutes}</i></strong><span>{copy.transfers} {property.transferCount}</span></div>
                        <b>+</b>
                        <div><small>{locale === "zh" ? "目的地站" : locale === "ja" ? "到着駅" : "Arrival station"} → {result.destination.name}</small><strong>{destinationWalkMinutes}<i>{copy.minutes}</i></strong><span>{copy.walk}</span></div>
                      </div>
                      <div className="recommendation-reasons">
                        {property.recommendationReasons.map((reason) => (
                          <span key={reason.text} className={reason.tone}>✓ {localizeReason(reason.text, locale)}</span>
                        ))}
                      </div>
                      <button type="button" className="score-toggle" onClick={() => setExpandedPropertyId(expanded ? null : property.id)} aria-expanded={expanded}>
                        {expanded ? copy.closeDetails : copy.details}<span>{expanded ? "−" : "+"}</span>
                      </button>
                      {expanded && (
                        <div className="listing-details">
                          <div className="why-matched">
                            <h5>Why we matched</h5>
                            {getWhyMatched(property, preferenceProfile, locale, result.destination.name).map(([title, explanation]) => (
                              <p key={`${title}:${explanation}`}><strong>{title}</strong><span>{explanation}</span></p>
                            ))}
                          </div>
                          <div><span>{copy.managementFee}</span><strong>¥{property.managementFeeYen.toLocaleString()}</strong></div>
                          <div><span>{copy.monthlyTotal}</span><strong>¥{(property.monthlyRentYen + property.managementFeeYen).toLocaleString()}</strong></div>
                          <div><span>{copy.nearestMarket}</span><strong>{copy.walk} {property.lifestyle?.nearestSupermarketWalkMinutes ?? "—"} {copy.minutes}</strong></div>
                          <div><span>10 min area</span><strong>Market {property.lifestyle?.supermarketsWithin10Minutes ?? "—"} · Store {property.lifestyle?.convenienceStoresWithin10Minutes ?? "—"} · Food {property.lifestyle?.restaurantsWithin10Minutes ?? "—"}</strong></div>
                          <p>{locale === "zh" ? "生活设施为确定性 Demo 数据；详细目标值与容忍度仅用于内部匹配。" : locale === "ja" ? "生活施設は決定的なDemoデータです。詳細な目標値と許容範囲は内部マッチだけに使用します。" : "Amenities are deterministic demo data. Detailed targets and tolerances are used only for internal matching."}</p>
                          {property.sourceUrl ? <a href={property.sourceUrl} target="_blank" rel="noreferrer">{locale === "zh" ? "查看原房源" : locale === "ja" ? "掲載元を見る" : "View source"} ↗</a> : <span className="demo-source">Demo property · no source link</span>}
                        </div>
                      )}
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="no-properties">{copy.noProperties}</div>
            )}</>}
          </section>
        </section>
      )}

      {result.reachableStations.length === 0 && !loading && (
        <section className="empty-state">
          <div className="empty-illustration"><span>35</span><small>min</small></div>
          <h2>{locale === "zh" ? "输入准确地点，开始寻找通勤圈" : locale === "ja" ? "正確な目的地を入力して通勤圏を検索" : "Enter an exact destination to start"}</h2>
          <p>{copy.exactRequired}</p>
        </section>
      )}

      <footer><span>よりみち · Commute Finder Demo</span><span>Made for Tokyo life, 2026</span></footer>
      <p className="data-credit">TravelTime API · Station data: HeartRails Express · Places: OpenStreetMap / Photon · Housing: MOCK / DEMO</p>
    </main>
  );
}
