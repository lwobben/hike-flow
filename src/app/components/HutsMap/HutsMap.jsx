"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import HutPopup from "./HutPopup";
import PlanTourModal from "./PlanTourModal";
import DateRangePicker from "./DateRangePicker";
import { MAP_TOURS_BY_ID } from "./tourHuts";
import guideStyles from "./MapGuide.module.css";

const MAX_SELECTED_FILTERS = 3;
const AVAIL_FETCH_CONCURRENCY = 4;
/** Refresh hut availability after this long so map greying stays roughly current. */
const AVAIL_CACHE_TTL_MS = 5 * 60 * 1000;

function fetchHutAvailability(hutReservationId) {
  return fetch(`/api/availability?hutId=${hutReservationId}`).then(
    async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.availability)) {
        throw new Error(body.error || "availability failed");
      }
      return {
        hutUnlocked: body.hutUnlocked ?? true,
        data: body.availability,
      };
    },
  );
}

function getAvailCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > AVAIL_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setAvailCache(cache, key, value) {
  cache.set(key, { ...value, fetchedAt: Date.now() });
}

function nightHasEnoughBeds(entry, bedsNeeded) {
  if (!entry) return false;
  if (String(entry.percentage || "").toUpperCase() === "FULL") return false;
  if (entry.freeBeds == null || entry.freeBeds === "") return false;
  const beds = Number(entry.freeBeds);
  return Number.isFinite(beds) && beds >= bedsNeeded;
}

function hutHasBedsInRange(avail, dateFrom, dateTo, bedsNeeded) {
  if (!avail || avail.error) return null;
  if (avail.hutUnlocked === false) return false;
  return (avail.data ?? []).some((entry) => {
    const day = String(entry.date).slice(0, 10);
    return (
      day >= dateFrom && day <= dateTo && nightHasEnoughBeds(entry, bedsNeeded)
    );
  });
}

/** Inclusive calendar nights from dateFrom to dateTo (YYYY-MM-DD). */
function nightsInRange(dateFrom, dateTo) {
  const nights = [];
  if (!dateFrom || !dateTo || dateFrom > dateTo) return nights;
  const cur = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  while (cur <= end && nights.length < 366) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    nights.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

/**
 * Share of nights in the date range with enough free beds.
 * Returns null when availability is unknown / still loading.
 */
function hutAvailabilityRatio(avail, dateFrom, dateTo, bedsNeeded) {
  if (!avail || avail.error) return null;
  if (avail.hutUnlocked === false) return 0;
  const nights = nightsInRange(dateFrom, dateTo);
  if (nights.length === 0) return null;
  const byDate = new Map(
    (avail.data ?? []).map((entry) => [String(entry.date).slice(0, 10), entry]),
  );
  let available = 0;
  for (const day of nights) {
    if (nightHasEnoughBeds(byDate.get(day), bedsNeeded)) available += 1;
  }
  return available / nights.length;
}

/** Red (0) → yellow (0.5) → green (1). */
function availabilityOutlineColor(ratio) {
  const hue = Math.max(0, Math.min(1, ratio)) * 120;
  return `hsl(${hue} 72% 40%)`;
}

const PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#5b8def", // mid blue
  "#f58231",
  "#c44dd6",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#469990",
  "#dcbeff",
  "#c4842d",
  "#fffac8",
  "#d94c4c",
  "#aaffc3",
  "#a3a329",
  "#ffd8b1",
  "#20c5a8", // teal — was a second blue too close to #5b8def
  "#a9a9a9",
  "#e6beff",
];

const MAP_STYLES = {
  detailed: "https://tiles.openfreemap.org/styles/bright",
  minimal: "https://tiles.openfreemap.org/styles/positron",
  terrain: {
    version: 8,
    sources: {
      opentopomap: {
        type: "raster",
        tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 17,
        attribution: "© OpenTopoMap contributors, © OpenStreetMap contributors",
      },
    },
    layers: [{ id: "raster-layer", type: "raster", source: "opentopomap" }],
  },
};

const STYLE_LABELS = {
  detailed: "Detailed",
  minimal: "Minimal",
  terrain: "Terrain",
};

/** Paths in OpenMapTiles usually appear around this zoom. */
const PATHS_VISIBLE_ZOOM = 13;

const NATIVE_PATH_LAYER_IDS = ["highway-path", "bridge-path", "tunnel-path"];
const HIKE_PATH_OVERLAY_ID = "hike-paths-bold";
const HIKE_TRACK_OVERLAY_ID = "hike-tracks-bold";

const PATH_WIDTH = ["interpolate", ["linear"], ["zoom"], 13, 2.2, 15, 4, 17, 6, 20, 8];

/** Instant: thicken built-in bright-style path layers (visible as soon as the style loads). */
function restyleNativePathLayers(map) {
  for (const id of NATIVE_PATH_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    try {
      map.setPaintProperty(id, "line-color", "#b45309");
      map.setPaintProperty(id, "line-opacity", 1);
      map.setPaintProperty(id, "line-width", PATH_WIDTH);
      map.setPaintProperty(id, "line-dasharray", [2, 0.5]);
      map.setLayoutProperty(id, "line-cap", "round");
      map.setLayoutProperty(id, "line-join", "round");
    } catch (err) {
      console.warn("restyle path layer failed", id, err);
    }
  }
}

/**
 * Restyle native paths + add thicker overlays on Detailed.
 * Returns true when overlays are in place; false if we should retry on idle.
 */
function ensureDetailedHikingPaths(map) {
  if (!map) return false;
  try {
    if (!map.isStyleLoaded()) return false;
  } catch {
    return false;
  }

  // Native restyle is available immediately — don't wait for idle/overlay.
  restyleNativePathLayers(map);

  if (!map.getSource("openmaptiles")) return false;

  for (const id of [HIKE_TRACK_OVERLAY_ID, HIKE_PATH_OVERLAY_ID]) {
    if (map.getLayer(id)) {
      try {
        map.removeLayer(id);
      } catch {
        /* ignore */
      }
    }
  }

  const beforeId = map.getLayer("edges-layer")
    ? "edges-layer"
    : map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;

  const addOverlay = (id, className, widthStops, dash) => {
    map.addLayer(
      {
        id,
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 13,
        filter: ["==", ["get", "class"], className],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#9a3412",
          "line-opacity": 0.95,
          "line-width": ["interpolate", ["linear"], ["zoom"], ...widthStops],
          "line-dasharray": dash,
        },
      },
      beforeId,
    );
  };

  try {
    addOverlay(HIKE_TRACK_OVERLAY_ID, "track", [13, 1.6, 15, 2.8, 17, 4.5], [
      3, 1.2,
    ]);
    addOverlay(HIKE_PATH_OVERLAY_ID, "path", [13, 2.5, 15, 4.5, 17, 7], [
      2, 0.45,
    ]);
    return true;
  } catch (err) {
    console.warn("hiking path overlay failed", err);
    return false;
  }
}

/** Apply paths now; if overlays aren't ready yet, finish them on the next idle. */
function applyDetailedHikingPaths(map) {
  if (ensureDetailedHikingPaths(map)) return;
  map.once("idle", () => ensureDetailedHikingPaths(map));
}

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

const CIRCLE_HUT_BOOKING_TIP =
  "For circle huts, booking is not available via the Alpenverein Hut Reservation. Check the hut's own website (see the `More info` section in the hut popup) for the preferred method of booking and checking availability, which is usually on that website, or by email or phone.";

const DIAMOND_HUT_BOOKING_TIP =
  "For diamond huts, click the `Book` link in the availability matrix or hut popup and reserve via the Alpenverein Hut Reservation.";

function GuideInfoIcon({ text }) {
  const iconRef = useRef(null);
  const [tipPos, setTipPos] = useState(null);

  const show = () => {
    const r = iconRef.current.getBoundingClientRect();
    setTipPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  };

  return (
    <span className={guideStyles.infoWrap}>
      <span
        ref={iconRef}
        className={guideStyles.infoIcon}
        onMouseEnter={show}
        onMouseLeave={() => setTipPos(null)}
        aria-label={text}
      >
        i
      </span>
      {tipPos &&
        createPortal(
          <span
            className={guideStyles.tooltip}
            style={{ top: tipPos.top, left: tipPos.left }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

export default function HutsMap({
  focusedTourId = null,
  onFocusedTourChange,
}) {
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
  const [mapZoom, setMapZoom] = useState(6);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [mapStyle, setMapStyle] = useState("detailed");
  const [showPlanTour, setShowPlanTour] = useState(false);
  const [tourSelectedHuts, setTourSelectedHuts] = useState([]);
  const [bedsNeeded, setBedsNeeded] = useState(2);
  const [hutSearch, setHutSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const selectedGroupsRef = useRef([]);
  const focusedTourIdRef = useRef(null);
  selectedGroupsRef.current = selectedGroups;
  focusedTourIdRef.current = focusedTourId;
  const focusedTour = focusedTourId ? MAP_TOURS_BY_ID[focusedTourId] : null;
  const filtersAtMax = selectedGroups.length >= MAX_SELECTED_FILTERS;
  const availCacheRef = useRef(new Map());
  const [filterAvailVersion, setFilterAvailVersion] = useState(0);
  const [filterAvailLoading, setFilterAvailLoading] = useState(false);
  const [availCacheTick, setAvailCacheTick] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const searchRef = useRef(null);
  const ignoreNextMapClick = useRef(false);
  const isMobileRef = useRef(false);
  const mapInteractiveRef = useRef(false);
  isMobileRef.current = isMobile;
  mapInteractiveRef.current = mapInteractive;

  const syncMapGestures = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const locked = isMobileRef.current && !mapInteractiveRef.current;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
      map.touchPitch,
    ];
    for (const handler of handlers) {
      if (locked) handler.disable();
      else handler.enable();
    }
  }, []);

  useEffect(() => {
    // Touch phones/tablets need the lock; desktop mouse/trackpad should always pan freely.
    const mq = window.matchMedia("(max-width: 767px) and (hover: none)");
    const sync = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile) setMapInteractive(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    syncMapGestures();
  }, [isMobile, mapInteractive, syncMapGestures]);

  // While moving the map, lock page scroll without blocking map pinch-zoom.
  useEffect(() => {
    if (!isMobile || !mapInteractive) return;

    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehavior = prev.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, mapInteractive]);

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
  const mountainGroups = useMemo(
    () =>
      [...new Set(huts.map((h) => h.gebirgsgruppe).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "de"),
      ),
    [huts],
  );

  const focusedTourHutIds = useMemo(() => {
    if (!focusedTour) return new Set();
    return new Set(focusedTour.officialHutIds);
  }, [focusedTour]);

  const collectFilterHuts = (groups, tourId) => {
    const tour = tourId ? MAP_TOURS_BY_ID[tourId] : null;
    const tourHutIds = new Set(tour?.officialHutIds ?? []);
    return hutsRef.current.filter(
      (hut) =>
        (groups.length > 0 && groups.includes(hut.gebirgsgruppe)) ||
        tourHutIds.has(hut.id),
    );
  };

  const fitMapToSelection = (groups, tourId) => {
    if (!mapRef.current) return;
    if (groups.length === 0 && !tourId) return;
    const selectedHuts = collectFilterHuts(groups, tourId);
    const places = tourId ? (MAP_TOURS_BY_ID[tourId]?.places ?? []) : [];
    if (selectedHuts.length === 0 && places.length === 0) return;

    const points = [
      ...selectedHuts.map((h) => [h.lon, h.lat]),
      ...places.map((p) => [p.lon, p.lat]),
    ];

    if (points.length === 1) {
      mapRef.current.easeTo({
        center: points[0],
        zoom: 10,
        duration: 700,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const pt of points) bounds.extend(pt);
    mapRef.current.fitBounds(bounds, {
      padding: isMobile ? 36 : 70,
      maxZoom: 10,
      duration: 700,
    });
  };

  const clearFocusedTour = () => {
    onFocusedTourChange?.(null);
  };

  const addMountainGroup = (group) => {
    if (!group) return;
    if (selectedGroups.includes(group)) return;
    if (filtersAtMax) return;

    const next = [...selectedGroups, group];
    setSelectedGroups(next);
    clearFocusedTour();
    setPopup(null);
    fitMapToSelection(next, null);
  };

  const removeMountainGroup = (group) => {
    const next = selectedGroups.filter((g) => g !== group);
    setSelectedGroups(next);
    setPopup(null);
    if (next.length > 0) {
      fitMapToSelection(next, null);
    }
  };

  const clearFilters = () => {
    setSelectedGroups([]);
    setPopup(null);
  };

  // When a tour is focused from TourList: clear mountain groups and fit the map.
  useEffect(() => {
    setHoveredPlace(null);
    if (!focusedTourId) return;
    setSelectedGroups([]);
    setPopup(null);
    // Wait a tick so the map container is laid out after scroll.
    const id = requestAnimationFrame(() =>
      fitMapToSelection([], focusedTourId),
    );
    return () => cancelAnimationFrame(id);
  }, [focusedTourId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedFilterHuts = useMemo(() => {
    if (selectedGroups.length === 0 && !focusedTourId) return [];
    return collectFilterHuts(selectedGroups, focusedTourId);
  }, [selectedGroups, focusedTourId, huts]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookableFilterHuts = useMemo(
    () => selectedFilterHuts.filter((h) => h.hutReservationId),
    [selectedFilterHuts],
  );

  // Prefetch availability for filtered diamond huts (cached by reservation id).
  useEffect(() => {
    if (bookableFilterHuts.length === 0) {
      setFilterAvailLoading(false);
      return;
    }

    let cancelled = false;
    const missing = bookableFilterHuts.filter(
      (h) =>
        !getAvailCache(availCacheRef.current, String(h.hutReservationId)),
    );

    if (missing.length === 0) {
      setFilterAvailLoading(false);
      setFilterAvailVersion((v) => v + 1);
      return;
    }

    setFilterAvailLoading(true);
    let nextIndex = 0;

    const worker = async () => {
      while (!cancelled) {
        const idx = nextIndex++;
        if (idx >= missing.length) return;
        const hut = missing[idx];
        const key = String(hut.hutReservationId);
        try {
          const result = await fetchHutAvailability(hut.hutReservationId);
          if (!cancelled) setAvailCache(availCacheRef.current, key, result);
        } catch {
          if (!cancelled)
            setAvailCache(availCacheRef.current, key, { error: true });
        }
        if (!cancelled) setFilterAvailVersion((v) => v + 1);
      }
    };

    Promise.all(
      Array.from(
        { length: Math.min(AVAIL_FETCH_CONCURRENCY, missing.length) },
        () => worker(),
      ),
    ).then(() => {
      if (!cancelled) setFilterAvailLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bookableFilterHuts, availCacheTick]);

  // Re-check cache expiry while filters stay active (bookings change over time).
  useEffect(() => {
    if (bookableFilterHuts.length === 0) return;
    const id = setInterval(
      () => setAvailCacheTick((t) => t + 1),
      AVAIL_CACHE_TTL_MS,
    );
    return () => clearInterval(id);
  }, [bookableFilterHuts.length]);

  const soldOutFilterHutIds = useMemo(() => {
    const ids = new Set();
    if (bookableFilterHuts.length === 0) return ids;

    for (const hut of bookableFilterHuts) {
      const cached = getAvailCache(
        availCacheRef.current,
        String(hut.hutReservationId),
      );
      const hasBeds = hutHasBedsInRange(
        cached,
        dateFrom,
        dateTo,
        bedsNeeded,
      );
      if (hasBeds === false) ids.add(hut.id);
    }
    return ids;
  }, [
    bookableFilterHuts,
    dateFrom,
    dateTo,
    bedsNeeded,
    filterAvailVersion,
    availCacheTick,
  ]);

  /** Hut id → share of nights with enough beds (mountain-group filter only). */
  const filterAvailRatioByHutId = useMemo(() => {
    const ratios = new Map();
    if (selectedGroups.length === 0 || !dateFrom || !dateTo) return ratios;

    for (const hut of bookableFilterHuts) {
      const cached = getAvailCache(
        availCacheRef.current,
        String(hut.hutReservationId),
      );
      const ratio = hutAvailabilityRatio(
        cached,
        dateFrom,
        dateTo,
        bedsNeeded,
      );
      if (ratio != null) ratios.set(hut.id, ratio);
    }
    return ratios;
  }, [
    selectedGroups.length,
    bookableFilterHuts,
    dateFrom,
    dateTo,
    bedsNeeded,
    filterAvailVersion,
    availCacheTick,
  ]);

  useEffect(() => {
    if (!popup || popup.type !== "hut" || !popup.hutReservationId) return;
    const id = popup.hutReservationId;
    const key = String(id);
    const cached = getAvailCache(availCacheRef.current, key);
    if (cached && !cached.error) {
      setPopup((prev) =>
        prev?.hutReservationId === id
          ? {
              ...prev,
              availability: {
                loading: false,
                hutUnlocked: cached.hutUnlocked ?? true,
                data: cached.data,
              },
            }
          : prev,
      );
      return;
    }
    setPopup((prev) =>
      prev ? { ...prev, availability: { loading: true } } : prev,
    );
    fetchHutAvailability(id)
      .then((res) => {
        setAvailCache(availCacheRef.current, key, res);
        setFilterAvailVersion((v) => v + 1);
        setPopup((prev) =>
          prev?.hutReservationId === id
            ? {
                ...prev,
                availability: {
                  loading: false,
                  hutUnlocked: res.hutUnlocked ?? true,
                  data: res.data,
                },
              }
            : prev,
        );
      })
      .catch(() => {
        setAvailCache(availCacheRef.current, key, { error: true });
        setPopup((prev) =>
          prev?.hutReservationId === id
            ? { ...prev, availability: { loading: false, error: true } }
            : prev,
        );
      });
  }, [popup?.hutReservationId, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called from map load, huts fetch, and graph fetch: no-ops until all three are ready
  const buildEdgeFeatures = useCallback(() => {
    const edges = graphRef.current;
    const hutsById = hutsByIdRef.current;
    if (!edges || hutsRef.current.length === 0) return [];

    const groups = selectedGroupsRef.current;
    const tour = focusedTourIdRef.current
      ? MAP_TOURS_BY_ID[focusedTourIdRef.current]
      : null;
    const tourHutIds = new Set(tour?.officialHutIds ?? []);
    const hasFilters = groups.length > 0 || tourHutIds.size > 0;
    const hutMatches = (hut) =>
      !hasFilters ||
      groups.includes(hut.gebirgsgruppe) ||
      tourHutIds.has(hut.id);

    return edges
      .map((e) => {
        const from = hutsById[e.from];
        const to = hutsById[e.to];
        if (!from || !to) return null;
        if (!hutMatches(from) || !hutMatches(to)) return null;
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
  }, []);

  const addEdgeLayer = useCallback(() => {
    const map = mapRef.current;
    if (
      !map ||
      !mapLoadedRef.current ||
      !graphRef.current ||
      hutsRef.current.length === 0
    )
      return;

    const features = buildEdgeFeatures();

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
  }, [buildEdgeFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("edges")) return;
    map.getSource("edges").setData({
      type: "FeatureCollection",
      features: buildEdgeFeatures(),
    });
    if (popup?.type === "edge") setPopup(null);
  }, [selectedGroups, focusedTourId, buildEdgeFeatures]); // eslint-disable-line react-hooks/exhaustive-deps

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
    map.once("style.load", () => {
      addEdgeLayer();
      if (mapStyle === "detailed") applyDetailedHikingPaths(map);
    });
    map.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.detailed,
      center: [13.4, 47.2],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("error", (e) => {
      if (e.error?.status === 0 || e.sourceId || e.tile) return;
      console.error(e.error);
    });

    map.on("load", () => {
      mapLoadedRef.current = true;
      setMapZoom(map.getZoom());
      forceUpdate((t) => t + 1);
      addEdgeLayer();
      applyDetailedHikingPaths(map);
    });
    map.on("move", () => forceUpdate((t) => t + 1));
    map.on("zoom", () => setMapZoom(map.getZoom()));
    map.on("click", () => {
      if (ignoreNextMapClick.current) {
        ignoreNextMapClick.current = false;
        return;
      }
      setPopup(null);
    });

    mapRef.current = map;
    syncMapGestures();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, [addEdgeLayer, syncMapGestures]);

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
    const cached = h.hutReservationId
      ? getAvailCache(availCacheRef.current, String(h.hutReservationId))
      : null;
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
      availability: h.hutReservationId
        ? cached && !cached.error
          ? {
              loading: false,
              hutUnlocked: cached.hutUnlocked ?? true,
              data: cached.data,
            }
          : { loading: true }
        : null,
    };
    setPopup(newPopup);
    if (h.hutReservationId && (!cached || cached.error)) {
      const key = String(h.hutReservationId);
      fetchHutAvailability(h.hutReservationId)
        .then((res) => {
          setAvailCache(availCacheRef.current, key, res);
          setFilterAvailVersion((v) => v + 1);
          setPopup((prev) =>
            prev?.hutReservationId === h.hutReservationId
              ? {
                  ...prev,
                  availability: {
                    loading: false,
                    hutUnlocked: res.hutUnlocked ?? true,
                    data: res.data,
                  },
                }
              : prev,
          );
        })
        .catch(() => {
          setAvailCache(availCacheRef.current, key, { error: true });
          setPopup((prev) =>
            prev?.hutReservationId === h.hutReservationId
              ? { ...prev, availability: { loading: false, error: true } }
              : prev,
          );
        });
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
    } else if (mapRef.current) {
      mapRef.current.once("moveend", () => openHutPopup(h));
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
    <div style={{ width: isMobile ? "100%" : "min(92vw, 1600px)" }}>
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
      <div className={guideStyles.steps}>
        <section
          className={`${guideStyles.step} ${guideStyles.stepExplore} ${guideStyles.stepCentered}`}
          aria-labelledby="guide-explore"
        >
          <div className={guideStyles.stepHeader}>
            <span className={guideStyles.stepNum}>1</span>
            <h2 id="guide-explore" className={guideStyles.stepTitle}>
              Explore &amp; filter
            </h2>
          </div>
          <ul className={guideStyles.stepList}>
            <li>
              <div className={guideStyles.bulletLine}>
                <span className={guideStyles.bulletLabel}>Map:</span>
                Get info by clicking on huts &amp; routes inbetween them
              </div>
            </li>
            <li>
              <div className={guideStyles.bulletLine}>
                <span className={guideStyles.bulletLabel}>Tours table:</span>
                <a href="#tour-examples">Browse itineraries</a>
              </div>
            </li>
            <li>
              <div className={guideStyles.bulletText}>
                <span className={guideStyles.bulletLabel}>Filters:</span>
                {" Set your max date range & required beds "}
                <GuideInfoIcon text="The hut popups use the selected date and beds for showing availabilities." />
                {", and mountain groups "}
                <GuideInfoIcon text="Select mountain groups to get a quick overview of how many nights each online-bookable hut still has with enough beds in your date range." />
                {" on the map"}
              </div>
            </li>
          </ul>
        </section>

        <section
          className={`${guideStyles.step} ${guideStyles.stepPlan} ${guideStyles.stepCentered}`}
          aria-labelledby="guide-plan"
        >
          <div className={guideStyles.stepHeader}>
            <span className={guideStyles.stepNum}>2</span>
            <h2 id="guide-plan" className={guideStyles.stepTitle}>
              Plan
            </h2>
          </div>
          <div className={guideStyles.stepBody}>
            <p className={guideStyles.stepLead}>Decided on your route?</p>
            <p className={guideStyles.stepCopy}>
              Select it here to check all online availability in a single view:
            </p>
            <button
              type="button"
              className={guideStyles.planButton}
              onClick={() => setShowPlanTour(true)}
            >
              Plan tour
            </button>
            <p className={guideStyles.circleNote}>
              <span className={guideStyles.circleIcon} aria-hidden />
              Availability not known? Check the hut&apos;s website
              <GuideInfoIcon text={CIRCLE_HUT_BOOKING_TIP} />
            </p>
          </div>
        </section>

        <section
          className={`${guideStyles.step} ${guideStyles.stepBook} ${guideStyles.stepCentered}`}
          aria-labelledby="guide-book"
        >
          <div className={guideStyles.stepHeader}>
            <span className={guideStyles.stepNum}>3</span>
            <h2 id="guide-book" className={guideStyles.stepTitle}>
              Book
            </h2>
          </div>
          <div className={guideStyles.stepBody}>
            <p className={guideStyles.stepLead}>Almost there!</p>
            <p className={guideStyles.bookNote}>
              <span className={guideStyles.diamondIcon} aria-hidden />
              Follow the link to directly book online!
              <GuideInfoIcon text={DIAMOND_HUT_BOOKING_TIP} />
            </p>
            <p className={guideStyles.bookNote}>
              <span className={guideStyles.circleIcon} aria-hidden />
              Book custom huts via the agreed upon method
              <GuideInfoIcon text={CIRCLE_HUT_BOOKING_TIP} />
            </p>
          </div>
        </section>
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
        className={guideStyles.mapFrame}
        style={{
          position: "relative",
          width: "100%",
          height: isMobile ? "min(500px, calc(100dvh - 260px))" : "calc(100dvh - 420px)",
          border: "none",
          borderRadius: 10,
          boxShadow:
            isMobile && mapInteractive
              ? "0 0 0 2px rgba(0, 112, 243, 0.35)"
              : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            ref={mapContainer}
            style={{
              width: "100%",
              height: "100%",
              // Give MapLibre full control of one- and two-finger gestures in move mode.
              touchAction: isMobile && mapInteractive ? "none" : "auto",
            }}
          />
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMapInteractive((v) => !v)}
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 12,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)",
              background: mapInteractive ? "#1e3a5f" : "rgba(255,255,255,0.95)",
              color: mapInteractive ? "#fff" : "#222",
              fontSize: "0.85em",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
            }}
          >
            {mapInteractive ? "Done moving map" : "Move map"}
          </button>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              flexWrap: "wrap",
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
                    mapStyle === key ? "#1e3a5f" : "rgba(255,255,255,0.9)",
                  color: mapStyle === key ? "#fff" : "#333",
                  cursor: "pointer",
                  fontWeight: mapStyle === key ? 600 : 400,
                }}
              >
                {STYLE_LABELS[key]}
              </button>
            ))}
          </div>
          {mapStyle === "detailed" && mapZoom < PATHS_VISIBLE_ZOOM && (
            <div
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid #ddd",
                fontSize: "0.72em",
                color: "#555",
                lineHeight: 1.35,
                maxWidth: 220,
              }}
            >
              Zoom in more to see all hiking paths
            </div>
          )}
        </div>

        {focusedTour && (
          <div className={guideStyles.tourItineraryNote}>
            These itineraries are a starting point, not a fixed plan! Combine or
            split stages, join or leave along the way, and shape the route
            around your preferences and hut availability.
          </div>
        )}

        <div className={guideStyles.mapToolbar}>
          <div className={guideStyles.mapToolbarRow}>
            <div className={guideStyles.mapCtrl}>
              <DateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              />
            </div>
            <label
              className={`${guideStyles.controlLabel} ${guideStyles.mapCtrl}`}
              title="Beds needed"
            >
              Beds
              <input
                type="number"
                min="1"
                max="99"
                inputMode="numeric"
                aria-label="Beds needed"
                value={bedsNeeded}
                onChange={(e) =>
                  setBedsNeeded(Math.max(1, parseInt(e.target.value) || 1))
                }
                className={guideStyles.bedsInput}
              />
            </label>
            <select
              className={`${guideStyles.groupSelect} ${guideStyles.mapCtrl}`}
              value=""
              onChange={(e) => {
                addMountainGroup(e.target.value);
                e.target.value = "";
              }}
              disabled={filtersAtMax}
            >
              <option value="">
                {selectedGroups.length === 0
                  ? "Add mountain group…"
                  : filtersAtMax
                    ? `Max ${MAX_SELECTED_FILTERS}`
                    : "Add mountain group…"}
              </option>
              {mountainGroups
                .filter((group) => !selectedGroups.includes(group))
                .map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
            </select>
          </div>
          {selectedGroups.length > 0 && (
            <div className={guideStyles.selectedGroups}>
              {selectedGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => removeMountainGroup(group)}
                  title={`Remove ${group}`}
                  className={guideStyles.groupChip}
                >
                  <span
                    className={guideStyles.groupChipDot}
                    style={{
                      background: groupColorMap.current[group] ?? "#888",
                    }}
                  />
                  {group}
                  <span aria-hidden style={{ opacity: 0.55 }}>
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className={guideStyles.clearLink}
              >
                Clear
              </button>
              {filterAvailLoading && (
                <span className={guideStyles.availStatus}>
                  Checking availability…
                </span>
              )}
            </div>
          )}
        </div>

        <div ref={searchRef} className={guideStyles.mapSearch}>
          <input
            type="text"
            placeholder="Search huts by name..."
            value={hutSearch}
            onChange={(e) => {
              setHutSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => hutSearch.trim() && setSearchOpen(true)}
            className={guideStyles.mapSearchInput}
          />
          {searchOpen && searchResults.length > 0 && (
            <ul className={guideStyles.mapSearchResults}>
              {searchResults.map((h) => (
                <li
                  key={h.id}
                  onClick={() => selectHutFromSearch(h)}
                  className="huts-search-item"
                >
                  <span className={guideStyles.mapSearchName}>{h.name}</span>
                  <span className={guideStyles.mapSearchMeta}>
                    {h.gebirgsgruppe && (
                      <span className={guideStyles.mapSearchGroup}>
                        {h.gebirgsgruppe}
                      </span>
                    )}
                    <span>{h.elevation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loading && (
          <div
            style={{
              position: "absolute",
              top: 48,
              right: 8,
              zIndex: 12,
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
            focusedTour?.places?.map((place) => {
              const { x, y } = mapRef.current.project([place.lon, place.lat]);
              const showLabel = hoveredPlace === place.name;
              return (
                <div
                  key={place.name}
                  onMouseEnter={() => setHoveredPlace(place.name)}
                  onMouseLeave={() => setHoveredPlace(null)}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    transform: "translate(-50%, -100%)",
                    zIndex: 5,
                    pointerEvents: "auto",
                    cursor: "default",
                    padding: "4px 8px 0",
                    marginTop: -4,
                  }}
                >
                  {showLabel && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "100%",
                        transform: "translateX(-50%)",
                        marginBottom: 2,
                        padding: "3px 7px",
                        borderRadius: 4,
                        background: "rgba(20,20,20,0.9)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    >
                      {place.name}
                    </div>
                  )}
                  <div
                    style={{
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
                      lineHeight: 0,
                    }}
                  >
                    <MapPin
                      size={28}
                      fill="#5c6570"
                      color="#5c6570"
                      strokeWidth={1.25}
                      style={{ display: "block", pointerEvents: "none" }}
                    />
                  </div>
                </div>
              );
            })}

          {mapRef.current &&
            huts.map((h, i) => {
              const { x, y } = mapRef.current.project([h.lon, h.lat]);
              const hasFilters =
                selectedGroups.length > 0 || focusedTourHutIds.size > 0;
              const matchesGroup =
                selectedGroups.length > 0 &&
                selectedGroups.includes(h.gebirgsgruppe);
              const matchesTour = focusedTourHutIds.has(h.id);
              const isSelected =
                !hasFilters || matchesGroup || matchesTour;
              const inPlan = tourSelectedHuts.find((s) => s.id === h.id);
              const isSoldOut = soldOutFilterHutIds.has(h.id);
              const availRatio = filterAvailRatioByHutId.get(h.id);
              const showAvailOutline =
                matchesGroup &&
                h.hutReservationId &&
                availRatio != null &&
                !inPlan;

              let outline;
              if (inPlan) outline = "3px solid #555";
              else if (showAvailOutline)
                outline = `2.5px solid ${availabilityOutlineColor(availRatio)}`;

              const availPct =
                availRatio != null ? Math.round(availRatio * 100) : null;

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
                  title={
                    showAvailOutline
                      ? `${h.name} (${availPct}% of nights have ${bedsNeeded}+ beds)`
                      : isSoldOut
                        ? `${h.name} (no ${bedsNeeded}+ bed night in date range)`
                        : h.name
                  }
                  style={{
                    position: "absolute",
                    left: x - 8,
                    top: y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: h.hutReservationId ? "0" : "50%",
                    transform: h.hutReservationId ? "rotate(45deg)" : undefined,
                    background: isSoldOut
                      ? "#111"
                      : (groupColorMap.current[h.gebirgsgruppe] ?? "#aaa"),
                    border: "2px solid #fff",
                    outline,
                    outlineOffset: "2px",
                    cursor: "pointer",
                    pointerEvents: "auto",
                    opacity: !isSelected ? 0.28 : 1,
                    zIndex: isSelected ? (showAvailOutline ? 3 : 2) : 1,
                    transition:
                      "opacity 180ms ease, background 180ms ease, outline-color 180ms ease",
                  }}
                />
              );
            })}
        </div>

        <HutPopup
          popup={effectivePopup}
          dateFrom={dateFrom}
          dateTo={dateTo}
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
          flexWrap: "wrap",
        }}
      >
        <div
          className="legend-tooltip"
          data-tooltip="Up-to-date availabilities are shown for these huts, with the date range based on the date picker on the map. They are easily bookable via the hut-reservation.org link in the popup."
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
        {focusedTour?.places?.length > 0 && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 4 }}
            title="Common start & end points for this tour"
          >
            <MapPin
              size={16}
              fill="#5c6570"
              color="#5c6570"
              strokeWidth={1.25}
            />
            Access point
          </div>
        )}
        {selectedGroups.length > 0 && filterAvailRatioByHutId.size > 0 && (
          <div
            className="legend-tooltip"
            data-tooltip={`Outline (continuous scale): share of nights in your date range with ${bedsNeeded}+ free beds, from green (all) through yellow (half) to red (none). If a hut has no free night at all, the diamond turns black.`}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "2px 4px 2px 2px",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  padding: 2.5,
                  background: `linear-gradient(135deg, ${availabilityOutlineColor(1)}, ${availabilityOutlineColor(0.5)}, ${availabilityOutlineColor(0)})`,
                  transform: "rotate(45deg)",
                  flexShrink: 0,
                  boxSizing: "content-box",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#888",
                    border: "2px solid #fff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div
                style={{
                  width: 12,
                  height: 12,
                  background: "#111",
                  border: "2px solid #fff",
                  outline: `2.5px solid ${availabilityOutlineColor(0)}`,
                  outlineOffset: 1,
                  transform: "rotate(45deg)",
                  flexShrink: 0,
                }}
              />
            </div>
            Availability outline
          </div>
        )}
        {soldOutFilterHutIds.size > 0 && selectedGroups.length === 0 && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            title={`No night in the selected date range has ${bedsNeeded}+ free beds`}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: "#111",
                border: "2px solid #fff",
                outline: "1px solid #888",
                transform: "rotate(45deg)",
                flexShrink: 0,
              }}
            />
            No free night in date range
          </div>
        )}
      </div>
    </div>
  );
}
