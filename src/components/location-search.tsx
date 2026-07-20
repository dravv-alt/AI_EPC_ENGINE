"use client";

import { useEffect, useRef, useState } from "react";
import { Anchor, Loader2, MapPin, Plane, Search } from "lucide-react";
import { type Place, type PlaceType } from "@/lib/geo/places";
import { searchPlaces } from "@/lib/geo/nearest";

type SearchResult = Place | { id: string; name: string; country: string; lat: number; lng: number; type: PlaceType; source: "nominatim" };

interface LocationSearchProps {
  placeholder?: string;
  value?: string;
  onSelect: (place: Place | { name: string; lat: number; lng: number }) => void;
}

const NOMINATIM_TIMEOUT_MS = 2_500;
const MAX_QUERY_LENGTH = 120;

function validCoordinates(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Local locations are always searched first. A public lookup is deliberately
// opt-in: free-form site names can be commercially sensitive and must not be
// sent to a public geocoding service without an operator's action.
export function LocationSearch({ placeholder = "Search location...", value = "", onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allowPublicSearch, setAllowPublicSearch] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestNumberRef = useRef(0);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    const requestNumber = ++requestNumberRef.current;
    abortRef.current?.abort();
    setLoading(false);
    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const localResults = searchPlaces(normalizedQuery);
      setResults(localResults);
      setIsOpen(true);
      if (!allowPublicSearch || localResults.length >= 3) return;

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
      setLoading(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(normalizedQuery)}&limit=5`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          referrerPolicy: "no-referrer"
        });
        if (!response.ok) throw new Error(`Public geocoder returned ${response.status}`);
        const payload: unknown = await response.json();
        if (requestNumber !== requestNumberRef.current || !Array.isArray(payload)) return;
        const publicResults: SearchResult[] = payload.flatMap((item): SearchResult[] => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const lat = Number(record.lat);
          const lng = Number(record.lon);
          const name = typeof record.display_name === "string" ? record.display_name : "";
          const placeId = typeof record.place_id === "number" || typeof record.place_id === "string" ? String(record.place_id) : "";
          if (!name || !placeId || !validCoordinates(lat, lng)) return [];
          return [{ id: `nominatim:${placeId}`, name, country: "", lat, lng, type: "city", source: "nominatim" }];
        });
        setResults((current) => [...current, ...publicResults.filter((candidate) => !current.some((item) => item.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase()))]);
      } catch (error) {
        // Cancellation and a transient public-service error retain local results;
        // no browser exception or stale data is exposed to the shipment form.
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults(localResults);
      } finally {
        window.clearTimeout(timeout);
        if (requestNumber === requestNumberRef.current) setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [allowPublicSearch, query]);

  function handleSelect(place: SearchResult) {
    setQuery(place.name.split(",")[0] ?? place.name);
    setIsOpen(false);
    onSelect(place);
  }

  function icon(type: string) {
    if (type === "port") return <Anchor className="w-4 h-4 text-blue-500" />;
    if (type === "airport") return <Plane className="w-4 h-4 text-teal-500" />;
    return <MapPin className="w-4 h-4 text-slate-400" />;
  }

  return <div style={{ position: "relative", width: "100%", fontFamily: "var(--body)" }} ref={wrapperRef}>
    <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#fffefa", border: "1px solid var(--line)", borderRadius: "5px", padding: "0 10px", minHeight: "40px" }}>
      <Search style={{ width: "16px", height: "16px", color: "var(--muted)", flexShrink: 0, marginRight: "8px" }} />
      <input type="text" maxLength={MAX_QUERY_LENGTH} style={{ flex: 1, width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "12px", color: "var(--ink)", padding: "4px 0" }} placeholder={placeholder} value={query} onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => { if (query.trim().length >= 2) setIsOpen(true); }} />
      {loading && <Loader2 aria-label="Searching public locations" style={{ width: "16px", height: "16px", color: "var(--primary, #2d463e)", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
    </div>
    <label style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "7px", fontSize: "11px", color: "var(--muted)" }}>
      <input type="checkbox" checked={allowPublicSearch} onChange={(event) => setAllowPublicSearch(event.target.checked)} />
      <span>Also search public OpenStreetMap when the local catalog has fewer than three matches. Your query is sent to that public service.</span>
    </label>
    {isOpen && results.length > 0 && <div style={{ position: "absolute", zIndex: 1000, top: "100%", left: 0, right: 0, marginTop: "8px", background: "var(--paper, #ffffff)", border: "1px solid var(--line, #e2e8f0)", borderRadius: "12px", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)", maxHeight: "320px", overflowY: "auto", padding: "8px", display: "grid", gap: "4px" }}>
      {results.map((place) => <button type="button" key={place.id} onClick={() => handleSelect(place)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", display: "flex", alignItems: "center", gap: "12px", background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", color: "var(--ink, #0f172a)" }}>
        <div style={{ display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "8px", background: place.type === "port" ? "#eff6ff" : place.type === "airport" ? "#f0fdfa" : "#f1f5f9", flexShrink: 0 }}>{icon(place.type)}</div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}><span style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{place.name}</span>{("source" in place && place.source === "nominatim") && <span style={{ fontSize: "11px", color: "var(--muted, #64748b)" }}>Public OpenStreetMap result</span>}</div>
      </button>)}
    </div>}
  </div>;
}
