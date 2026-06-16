"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Switch } from "@/components/ui/switch";
import HutPopup from "./HutPopup";
import PlanTourModal from "./PlanTourModal";
import DateRangePicker from "./DateRangePicker";
const PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#469990",
  "#dcbeff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
  "#e6beff",
];

const MAP_STYLES = {
  minimal: "https://tiles.openfreemap.org/styles/positron",
  detailed: "https://tiles.openfreemap.org/styles/bright",
  terrain: {
    version: 8,
    sources: {
      opentopomap: {
        type: "raster",
        tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenTopoMap contributors, © OpenStreetMap contributors",
      },
    },
    layers: [{ id: "raster-layer", type: "raster", source: "opentopomap" }],
  },
};

const STYLE_LABELS = {
  minimal: "Minimal",
  detailed: "Detailed",
  terrain: "Terrain",
};

function buildGroupColorMap(huts) {
  const colorMap = {};
  let i = 0;
  for (const h of huts) {
    if (h.gebirgsgruppe && !(h.gebirgsgruppe in colorMap)) {
      colorMap[h.gebirgsgruppe] = PALETTE[i++ % PALETTE.length];
    }
  }
  return colorMap;
}

function curvedCoords(from, to) {
  const dLon = to.lon - from.lon;
  const dLat = to.lat - from.lat;
  const len = Math.sqrt(dLon * dLon + dLat * dLat);
  if (len === 0)
    return [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ];

  const sign = from.id < to.id ? 1 : -1;
  const amplitude = len * 0.25;
  const cx = (from.lon + to.lon) / 2 + (-dLat / len) * amplitude * sign;
  const cy = (from.lat + to.lat) / 2 + (dLon / len) * amplitude * sign;

  const steps = 8;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon =
      (1 - t) * (1 - t) * from.lon + 2 * (1 - t) * t * cx + t * t * to.lon;
    const lat =
      (1 - t) * (1 - t) * from.lat + 2 * (1 - t) * t * cy + t * t * to.lat;
    points.push([lon, lat]);
  }
  return points;
}

export default function HutsMap() {
  const containerRef = useRef(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hutsRef = useRef([]);
  const hutsByIdRef = useRef({});
  const edgesByKeyRef = useRef({});
  const groupColorMap = useRef({});
  const mapLoadedRef = useRef(false);
  const graphRef = useRef(null);
  const animFrameRef = useRef(null);
  const [huts, setHuts] = useState([]);
  const [, forceUpdate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [showAvailability, setShowAvailability] = useState(true);
  const [mapStyle, setMapStyle] = useState("minimal");
  const [showPlanTour, setShowPlanTour] = useState(false);
  const [tourSelectedHuts, setTourSelectedHuts] = useState([]);
  const [bedsNeeded, setBedsNeeded] = useState(2);
  const [hutSearch, setHutSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const searchRef = useRef(null);
  const ignoreNextMapClick = useRef(false);

  const defaultFrom = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1,
  );
  const defaultTo = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 2,
    1,
  );
  const toInputValue = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [dateFrom, setDateFrom] = useState(toInputValue(defaultFrom));
  const [dateTo, setDateTo] = useState(toInputValue(defaultTo));

  useEffect(() => {
    if (!popup || popup.type !== "hut" || !popup.hutReservationId) return;
    if (!showAvailability) {
      setPopup((prev) => (prev ? { ...prev, availability: null } : prev));
      return;
    }
    setPopup((prev) =>
      prev ? { ...prev, availability: { loading: true } } : prev,
    );
    const id = popup.hutReservationId;
    fetch(`/api/availability?hutId=${id}`)
      .then((res) => res.json())
      .then((res) =>
        setPopup((prev) =>
          prev?.hutReservationId === id
            ? {
                ...prev,
                availability: {
                  loading: false,
                  hutUnlocked: res.hutUnlocked ?? true,
                  data: Array.isArray(res.availability) ? res.availability : [],
                },
              }
            : prev,
        ),
      )
      .catch(() =>
        setPopup((prev) =>
          prev?.hutReservationId === id
            ? { ...prev, availability: { loading: false, error: true } }
            : prev,
        ),
      );
  }, [showAvailability]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called from map load, huts fetch, and graph fetch: no-ops until all three are ready
  const addEdgeLayer = useCallback(() => {
    const map = mapRef.current;
    if (
      !map ||
      !mapLoadedRef.current ||
      !graphRef.current ||
      hutsRef.current.length === 0
    )
      return;

    const edges = graphRef.current;
    const hutsById = hutsByIdRef.current;

    const features = edges
      .map((e) => {
        const from = hutsById[e.from];
        const to = hutsById[e.to];
        if (!from || !to) return null;
        return {
          type: "Feature",
          properties: { from: e.from, to: e.to },
          geometry: {
            type: "LineString",
            coordinates: curvedCoords(from, to),
          },
        };
      })
      .filter(Boolean);

    if (map.getSource("edges")) {
      map.getSource("edges").setData({ type: "FeatureCollection", features });
    } else {
      map.addSource("edges", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      const dashSequence = [
        [0, 4, 3],
        [0.5, 4, 2.5],
        [1, 4, 2],
        [1.5, 4, 1.5],
        [2, 4, 1],
        [2.5, 4, 0.5],
        [3, 4, 0],
        [0, 0.5, 3, 3.5],
        [0, 1, 3, 3],
        [0, 1.5, 3, 2.5],
        [0, 2, 3, 2],
        [0, 2.5, 3, 1.5],
        [0, 3, 3, 1],
        [0, 3.5, 3, 0.5],
      ];
      let step = 0;
      map.addLayer({
        id: "edges-layer",
        type: "line",
        source: "edges",
        paint: {
          "line-color": "#555",
          "line-width": 2,
          "line-opacity": 0.7,
          "line-dasharray": dashSequence[0],
        },
      });

      const animate = (timestamp) => {
        const newStep = Math.floor((timestamp / 50) % dashSequence.length);
        if (newStep !== step) {
          map.setPaintProperty(
            "edges-layer",
            "line-dasharray",
            dashSequence[newStep],
          );
          step = newStep;
        }
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
      map.addLayer({
        id: "edges-layer-hit",
        type: "line",
        source: "edges",
        paint: { "line-width": 10, "line-opacity": 0 },
      });

      map.on("click", "edges-layer-hit", (e) => {
        const { from, to } = e.features[0].properties;
        const fromHut = hutsByIdRef.current[from];
        const toHut = hutsByIdRef.current[to];
        const fwd = edgesByKeyRef.current[`${from}-${to}`];
        const rev = edgesByKeyRef.current[`${to}-${from}`];
        const rect = containerRef.current.getBoundingClientRect();
        setPopup({
          type: "edge",
          fromName: fromHut?.name ?? from,
          fromElevation: fromHut?.elevation ?? null,
          toName: toHut?.name ?? to,
          toElevation: toHut?.elevation ?? null,
          fwdMinutes: fwd ?? null,
          revMinutes: rev ?? null,
          x: e.originalEvent.clientX - rect.left,
          y: e.originalEvent.clientY - rect.top,
        });
      });

      map.on("mouseenter", "edges-layer-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "edges-layer-hit", () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, []);

  // Fetch huts
  useEffect(() => {
    fetch("/api/huts")
      .then((res) => res.json())
      .then((data) => {
        const valid = (data || []).filter((h) => h.lat && h.lon);
        groupColorMap.current = buildGroupColorMap(valid);
        hutsRef.current = valid;
        hutsByIdRef.current = Object.fromEntries(valid.map((h) => [h.id, h]));
        const edges = valid.flatMap((h) =>
          (h.edges ?? []).map((e) => ({ from: h.id, ...e })),
        );
        graphRef.current = edges;
        const lookup = {};
        for (const e of edges) lookup[`${e.from}-${e.to}`] = e.minutes;
        edgesByKeyRef.current = lookup;
        setHuts(valid);
        addEdgeLayer();
      })
      .finally(() => setLoading(false));
  }, [addEdgeLayer]);

  // Style switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.once("style.load", () => addEdgeLayer());
    map.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.minimal,
      center: [13.4, 47.2],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;
      forceUpdate((t) => t + 1);
      addEdgeLayer();
    });
    map.on("move", () => forceUpdate((t) => t + 1));
    map.on("click", () => {
      if (ignoreNextMapClick.current) {
        ignoreNextMapClick.current = false;
        return;
      }
      setPopup(null);
    });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [addEdgeLayer]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return;
    function onDown(e) {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  const searchResults = hutSearch.trim()
    ? huts
        .filter((h) => h.name.toLowerCase().includes(hutSearch.toLowerCase()))
        .slice(0, 10)
    : [];

  function openHutPopup(h) {
    const hutId = String(h.id);
    const outgoing = new Map();
    const incoming = new Map();
    for (const [key, minutes] of Object.entries(edgesByKeyRef.current)) {
      if (key.startsWith(`${hutId}-`)) {
        outgoing.set(key.slice(hutId.length + 1), minutes);
      } else if (key.endsWith(`-${hutId}`)) {
        incoming.set(key.slice(0, key.length - hutId.length - 1), minutes);
      }
    }
    const neighbors = [];
    for (const [neighborId, minutes] of outgoing) {
      const n = hutsByIdRef.current[neighborId];
      if (n) neighbors.push({ name: n.name, minutes });
    }
    for (const [neighborId, reverseMinutes] of incoming) {
      if (!outgoing.has(neighborId)) {
        const n = hutsByIdRef.current[neighborId];
        if (n) neighbors.push({ name: n.name, minutes: null, reverseMinutes });
      }
    }
    neighbors.sort((a, b) => {
      if (a.minutes !== null && b.minutes !== null)
        return a.minutes - b.minutes;
      return a.minutes !== null ? -1 : 1;
    });
    const newPopup = {
      type: "hut",
      name: h.name,
      elevation: h.elevation,
      link: h.link,
      websites: h.websites ?? [],
      bahnhof: h.bahnhof ?? null,
      bushaltestelle: h.bushaltestelle ?? null,
      pkw: h.pkw ?? null,
      parkmoeglichkeiten: h.parkmoeglichkeiten ?? null,
      approaches: h.approaches ?? h.zustiege ?? [],
      tours: h.tours ?? h.touren ?? [],
      neighbors,
      gebirgsgruppe: h.gebirgsgruppe,
      bundesland: h.bundesland,
      hutReservationId: h.hutReservationId ?? null,
      lon: h.lon,
      lat: h.lat,
      availability:
        showAvailability && h.hutReservationId ? { loading: true } : null,
    };
    setPopup(newPopup);
    if (showAvailability && h.hutReservationId) {
      fetch(`/api/availability?hutId=${h.hutReservationId}`)
        .then((res) => res.json())
        .then((res) =>
          setPopup((prev) =>
            prev?.hutReservationId === h.hutReservationId
              ? {
                  ...prev,
                  availability: {
                    loading: false,
                    hutUnlocked: res.hutUnlocked ?? true,
                    data: Array.isArray(res.availability)
                      ? res.availability
                      : [],
                  },
                }
              : prev,
          ),
        )
        .catch(() =>
          setPopup((prev) =>
            prev?.hutReservationId === h.hutReservationId
              ? { ...prev, availability: { loading: false, error: true } }
              : prev,
          ),
        );
    }
  }

  function selectHutFromSearch(h) {
    setHutSearch("");
    setSearchOpen(false);
    if (mapRef.current) {
      ignoreNextMapClick.current = true;
      mapRef.current.flyTo({
        center: [h.lon, h.lat],
        zoom: Math.max(mapRef.current.getZoom(), 11),
        duration: 600,
      });
    }
    if (showPlanTour) {
      setTourSelectedHuts((prev) => [
        ...prev,
        { ...h, _uid: crypto.randomUUID() },
      ]);
    } else {
      openHutPopup(h);
    }
  }

  const effectivePopup = (() => {
    if (!popup) return null;
    if (popup.type !== "hut" || !mapRef.current) return popup;
    const { x, y } = mapRef.current.project([popup.lon, popup.lat]);
    const el = containerRef.current;
    if (el && (x < 0 || x > el.offsetWidth || y < 0 || y > el.offsetHeight))
      return null;
    return { ...popup, x, y };
  })();

  return (
    <div style={{ width: isMobile ? "100%" : 1100 }}>
      {isMobile && !disclaimerDismissed && (
        <div
          style={{
            background: "var(--huts-disclaimer-bg, #fffbeb)",
            border: "1px solid var(--huts-disclaimer-border, #f59e0b)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: "0.85em",
            color: "var(--huts-disclaimer-text, #78350f)",
          }}
        >
          <span style={{ flex: 1 }}>
            This app is not optimized for mobile use. For the best experience, open it on a desktop or laptop.
          </span>
          <button
            onClick={() => setDisclaimerDismissed(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--huts-disclaimer-text, #78350f)",
              fontWeight: 700,
              fontSize: "1.1em",
              lineHeight: 1,
              flexShrink: 0,
              padding: "0 2px",
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: isMobile ? 10 : 40,
          marginBottom: 8,
        }}
      >
        {/* Hut search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search huts…"
            value={hutSearch}
            onChange={(e) => {
              setHutSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => hutSearch.trim() && setSearchOpen(true)}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--huts-ctrl-border, #ccc)",
              borderRadius: 4,
              fontSize: "0.85em",
              width: isMobile ? "100%" : 180,
            }}
          />
          {searchOpen && searchResults.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                width: 260,
                background: "var(--huts-dropdown-bg, #fff)",
                border: "1px solid var(--huts-dropdown-border, #ddd)",
                borderRadius: 4,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                margin: 0,
                padding: 0,
                listStyle: "none",
                zIndex: 3000,
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              {searchResults.map((h) => (
                <li
                  key={h.id}
                  onClick={() => selectHutFromSearch(h)}
                  className="huts-search-item"
                  style={{
                    padding: "7px 12px",
                    cursor: "pointer",
                    fontSize: "0.85em",
                    borderBottom: "1px solid var(--huts-dropdown-border, #f0f0f0)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.name}
                  </span>
                  <span
                    style={{
                      color: "#bbb",
                      flexShrink: 0,
                      fontSize: "0.82em",
                      textAlign: "right",
                    }}
                  >
                    {h.gebirgsgruppe && (
                      <span style={{ display: "block", color: "#ccc" }}>
                        {h.gebirgsgruppe}
                      </span>
                    )}
                    <span style={{ display: "block" }}>{h.elevation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <Switch
            checked={showAvailability}
            onCheckedChange={setShowAvailability}
          />
          Show availabilities
        </label>
        {showAvailability && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.85em",
                color: "var(--huts-ctrl-muted, #555)",
              }}
            >
              Beds:
              <input
                type="number"
                min="1"
                max="99"
                value={bedsNeeded}
                onChange={(e) =>
                  setBedsNeeded(Math.max(1, parseInt(e.target.value) || 1))
                }
                style={{
                  width: 48,
                  padding: "3px 5px",
                  border: "1px solid var(--huts-ctrl-border, #ccc)",
                  borderRadius: 4,
                  fontSize: "0.85em",
                }}
              />
            </label>
          </div>
        )}
        <button
          onClick={() => setShowPlanTour(true)}
          style={{
            marginLeft: 16,
            padding: "4px 12px",
            fontSize: "0.85em",
            borderRadius: 4,
            border: "1px solid #0070f3",
            background: "#0070f3",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Plan tour
        </button>
      </div>

      {showPlanTour && (
        <PlanTourModal
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => {
            setShowPlanTour(false);
            setTourSelectedHuts([]);
          }}
          selectedHuts={tourSelectedHuts}
          onSelectedHutsChange={setTourSelectedHuts}
          bedsNeeded={bedsNeeded}
        />
      )}

      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: isMobile ? "min(500px, calc(100dvh - 260px))" : 700,
          border: "1px solid #ddd",
        }}
      >
        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            display: "flex",
            gap: 4,
            zIndex: 10,
          }}
        >
          {Object.keys(MAP_STYLES).map((key) => (
            <button
              key={key}
              onClick={() => setMapStyle(key)}
              style={{
                padding: "4px 10px",
                fontSize: "0.78em",
                borderRadius: 4,
                border: "1px solid #aaa",
                background:
                  mapStyle === key ? "#0070f3" : "rgba(255,255,255,0.9)",
                color: mapStyle === key ? "#fff" : "#333",
                cursor: "pointer",
                fontWeight: mapStyle === key ? 600 : 400,
              }}
            >
              {STYLE_LABELS[key]}
            </button>
          ))}
        </div>

        {loading && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(255,255,255,0.8)",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: "0.85em",
            }}
          >
            Loading huts…
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {mapRef.current &&
            huts.map((h, i) => {
              const { x, y } = mapRef.current.project([h.lon, h.lat]);
              return (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showPlanTour) {
                      setTourSelectedHuts((prev) => [
                        ...prev,
                        { ...h, _uid: crypto.randomUUID() },
                      ]);
                      return;
                    }
                    openHutPopup(h);
                  }}
                  style={{
                    position: "absolute",
                    left: x - 8,
                    top: y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: h.hutReservationId ? "0" : "50%",
                    transform: h.hutReservationId ? "rotate(45deg)" : undefined,
                    background:
                      groupColorMap.current[h.gebirgsgruppe] ?? "#aaa",
                    border: "2px solid #fff",
                    outline: tourSelectedHuts.find((s) => s.id === h.id)
                      ? "3px solid #0070f3"
                      : undefined,
                    outlineOffset: "2px",
                    cursor: "pointer",
                    pointerEvents: "auto",
                  }}
                />
              );
            })}
        </div>

        <HutPopup
          popup={effectivePopup}
          dateFrom={dateFrom}
          dateTo={dateTo}
          showAvailability={showAvailability}
          bedsNeeded={bedsNeeded}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          fontSize: "0.85em",
          color: "var(--huts-ctrl-text, #444)",
        }}
      >
        <div
          className="legend-tooltip"
          data-tooltip="Up-to-date availabilities are shown for these huts, with the date range based on the date picker above. They are easily bookable via the hut-reservation.org link in the popup."
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              background: "#888",
              border: "2px solid #fff",
              outline: "1px solid #888",
              transform: "rotate(45deg)",
              flexShrink: 0,
            }}
          />
          Availabilities shown, bookable via hut-reservation.org
        </div>
        <div
          className="legend-tooltip"
          data-tooltip="Availabilities cannot be checked here automatically. To reserve, visit the hut's own website or contact them directly."
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#888",
              border: "2px solid #fff",
              outline: "1px solid #888",
              flexShrink: 0,
            }}
          />
          Book directly with the hut
        </div>
      </div>
    </div>
  );
}
