"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Switch } from "@/components/ui/switch";
import HutPopup from "./HutPopup";
import PlanTourModal from "./PlanTourModal";
import DateRangePicker from "./DateRangePicker";
import { MAP_TOURS, MAP_TOURS_BY_ID } from "./tourHuts";

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
  minimal: "https://tiles.openfreemap.org/styles/positron",
  detailed: "https://tiles.openfreemap.org/styles/bright",
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
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedTours, setSelectedTours] = useState([]);
  const selectedGroupsRef = useRef([]);
  const selectedToursRef = useRef([]);
  selectedGroupsRef.current = selectedGroups;
  selectedToursRef.current = selectedTours;
  const selectedFilterCount = selectedGroups.length + selectedTours.length;
  const filtersAtMax = selectedFilterCount >= MAX_SELECTED_FILTERS;
  const availCacheRef = useRef(new Map());
  const [filterAvailVersion, setFilterAvailVersion] = useState(0);
  const [filterAvailLoading, setFilterAvailLoading] = useState(false);
  const [availCacheTick, setAvailCacheTick] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
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

  const collectFilterHuts = (groups, tourIds) => {
    const tourHutIds = new Set();
    for (const tourId of tourIds) {
      const tour = MAP_TOURS_BY_ID[tourId];
      if (!tour) continue;
      for (const id of tour.officialHutIds) tourHutIds.add(id);
      for (const id of tour.optionalHutIds) tourHutIds.add(id);
    }
    return hutsRef.current.filter(
      (hut) =>
        (groups.length > 0 && groups.includes(hut.gebirgsgruppe)) ||
        tourHutIds.has(hut.id),
    );
  };

  const fitMapToSelection = (groups, tourIds) => {
    if (!mapRef.current) return;
    if (groups.length === 0 && tourIds.length === 0) return;
    const selectedHuts = collectFilterHuts(groups, tourIds);
    if (selectedHuts.length === 0) return;

    if (selectedHuts.length === 1) {
      mapRef.current.easeTo({
        center: [selectedHuts[0].lon, selectedHuts[0].lat],
        zoom: 10,
        duration: 700,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const hut of selectedHuts) bounds.extend([hut.lon, hut.lat]);
    mapRef.current.fitBounds(bounds, {
      padding: isMobile ? 36 : 70,
      maxZoom: 10,
      duration: 700,
    });
  };

  const addMountainGroup = (group) => {
    if (!group) return;
    if (selectedGroups.includes(group)) return;
    if (filtersAtMax) return;

    const next = [...selectedGroups, group];
    setSelectedGroups(next);
    setPopup(null);
    fitMapToSelection(next, selectedTours);
  };

  const removeMountainGroup = (group) => {
    const next = selectedGroups.filter((g) => g !== group);
    setSelectedGroups(next);
    setPopup(null);
    if (next.length > 0 || selectedTours.length > 0) {
      fitMapToSelection(next, selectedTours);
    }
  };

  const addTour = (tourId) => {
    if (!tourId) return;
    if (selectedTours.includes(tourId)) return;
    if (filtersAtMax) return;

    const next = [...selectedTours, tourId];
    setSelectedTours(next);
    setPopup(null);
    fitMapToSelection(selectedGroups, next);
  };

  const removeTour = (tourId) => {
    const next = selectedTours.filter((id) => id !== tourId);
    setSelectedTours(next);
    setPopup(null);
    if (selectedGroups.length > 0 || next.length > 0) {
      fitMapToSelection(selectedGroups, next);
    }
  };

  const clearFilters = () => {
    setSelectedGroups([]);
    setSelectedTours([]);
    setPopup(null);
  };

  const hutTourRoles = useMemo(() => {
    const roles = new Map();
    for (const tourId of selectedTours) {
      const tour = MAP_TOURS_BY_ID[tourId];
      if (!tour) continue;
      for (const id of tour.optionalHutIds) {
        if (!roles.has(id)) roles.set(id, "optional");
      }
      for (const id of tour.officialHutIds) {
        roles.set(id, "official");
      }
    }
    return roles;
  }, [selectedTours]);

  const selectedFilterHuts = useMemo(() => {
    if (selectedGroups.length === 0 && selectedTours.length === 0) return [];
    return collectFilterHuts(selectedGroups, selectedTours);
  }, [selectedGroups, selectedTours, huts]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookableFilterHuts = useMemo(
    () => selectedFilterHuts.filter((h) => h.hutReservationId),
    [selectedFilterHuts],
  );

  // Prefetch availability for filtered diamond huts (cached by reservation id).
  useEffect(() => {
    if (!showAvailability) {
      setFilterAvailLoading(false);
      return;
    }
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
  }, [showAvailability, bookableFilterHuts, availCacheTick]);

  // Re-check cache expiry while filters stay active (bookings change over time).
  useEffect(() => {
    if (!showAvailability || bookableFilterHuts.length === 0) return;
    const id = setInterval(
      () => setAvailCacheTick((t) => t + 1),
      AVAIL_CACHE_TTL_MS,
    );
    return () => clearInterval(id);
  }, [showAvailability, bookableFilterHuts.length]);

  const soldOutFilterHutIds = useMemo(() => {
    const ids = new Set();
    if (!showAvailability) return ids;
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
    showAvailability,
    bookableFilterHuts,
    dateFrom,
    dateTo,
    bedsNeeded,
    filterAvailVersion,
    availCacheTick,
  ]);

  useEffect(() => {
    if (!popup || popup.type !== "hut" || !popup.hutReservationId) return;
    if (!showAvailability) {
      setPopup((prev) => (prev ? { ...prev, availability: null } : prev));
      return;
    }
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
  }, [showAvailability]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called from map load, huts fetch, and graph fetch: no-ops until all three are ready
  const buildEdgeFeatures = useCallback(() => {
    const edges = graphRef.current;
    const hutsById = hutsByIdRef.current;
    if (!edges || hutsRef.current.length === 0) return [];

    const groups = selectedGroupsRef.current;
    const tours = selectedToursRef.current;
    const tourHutIds = new Set();
    for (const tourId of tours) {
      const tour = MAP_TOURS_BY_ID[tourId];
      if (!tour) continue;
      for (const id of tour.officialHutIds) tourHutIds.add(id);
      for (const id of tour.optionalHutIds) tourHutIds.add(id);
    }
    const hasFilters = groups.length > 0 || tours.length > 0;
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
  }, [selectedGroups, selectedTours, buildEdgeFeatures]); // eslint-disable-line react-hooks/exhaustive-deps

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

    map.on("error", (e) => {
      if (e.error?.status === 0 || e.sourceId || e.tile) return;
      console.error(e.error);
    });

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
    const cached =
      showAvailability && h.hutReservationId
        ? getAvailCache(
            availCacheRef.current,
            String(h.hutReservationId),
          )
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
      availability:
        showAvailability && h.hutReservationId
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
    if (showAvailability && h.hutReservationId && (!cached || cached.error)) {
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
              background: "#fff",
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: isMobile ? "100%" : "auto",
            maxWidth: isMobile ? "100%" : 420,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.85em",
              color: "var(--huts-ctrl-muted, #555)",
              width: "100%",
            }}
          >
            Mountain groups:
            <select
              value=""
              onChange={(e) => {
                addMountainGroup(e.target.value);
                e.target.value = "";
              }}
              disabled={filtersAtMax}
              style={{
                minWidth: 190,
                maxWidth: isMobile ? "100%" : 260,
                flex: 1,
                padding: "4px 8px",
                border: "1px solid var(--huts-ctrl-border, #ccc)",
                borderRadius: 4,
                fontSize: "inherit",
                color: "var(--huts-ctrl-text, #333)",
                background: "#fff",
              }}
            >
              <option value="">
                {selectedGroups.length === 0 && selectedTours.length === 0
                  ? "All mountain groups"
                  : filtersAtMax
                    ? `Max ${MAX_SELECTED_FILTERS} filters`
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
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.85em",
              color: "var(--huts-ctrl-muted, #555)",
              width: "100%",
            }}
          >
            Tours:
            <select
              value=""
              onChange={(e) => {
                addTour(e.target.value);
                e.target.value = "";
              }}
              disabled={filtersAtMax}
              style={{
                minWidth: 190,
                maxWidth: isMobile ? "100%" : 260,
                flex: 1,
                padding: "4px 8px",
                border: "1px solid var(--huts-ctrl-border, #ccc)",
                borderRadius: 4,
                fontSize: "inherit",
                color: "var(--huts-ctrl-text, #333)",
                background: "#fff",
              }}
            >
              <option value="">
                {selectedTours.length === 0 && selectedGroups.length === 0
                  ? "All tours"
                  : filtersAtMax
                    ? `Max ${MAX_SELECTED_FILTERS} filters`
                    : "Add tour…"}
              </option>
              {MAP_TOURS.filter((tour) => !selectedTours.includes(tour.id)).map(
                (tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title}
                  </option>
                ),
              )}
            </select>
          </label>
          {(selectedGroups.length > 0 || selectedTours.length > 0) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              {selectedGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => removeMountainGroup(group)}
                  title={`Remove ${group}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    border: "1px solid var(--huts-ctrl-border, #ccc)",
                    borderRadius: 4,
                    background: "#fff",
                    color: "var(--huts-ctrl-text, #333)",
                    fontSize: "0.8em",
                    cursor: "pointer",
                    lineHeight: 1.3,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: groupColorMap.current[group] ?? "#888",
                      flexShrink: 0,
                    }}
                  />
                  {group}
                  <span aria-hidden style={{ opacity: 0.55 }}>
                    ×
                  </span>
                </button>
              ))}
              {selectedTours.map((tourId) => {
                const tour = MAP_TOURS_BY_ID[tourId];
                return (
                  <button
                    key={tourId}
                    type="button"
                    onClick={() => removeTour(tourId)}
                    title={`Remove ${tour?.title ?? tourId}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      border: "1px solid #7a9bb8",
                      borderRadius: 4,
                      background: "#f3f7fb",
                      color: "var(--huts-ctrl-text, #333)",
                      fontSize: "0.8em",
                      cursor: "pointer",
                      lineHeight: 1.3,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: "#3d6f99",
                        flexShrink: 0,
                      }}
                    />
                    {tour?.title ?? tourId}
                    <span aria-hidden style={{ opacity: 0.55 }}>
                      ×
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--huts-ctrl-muted, #555)",
                  fontSize: "0.8em",
                  cursor: "pointer",
                  padding: "2px 4px",
                  textDecoration: "underline",
                }}
              >
                Clear
              </button>
              {filterAvailLoading && showAvailability && (
                <span
                  style={{
                    fontSize: "0.78em",
                    color: "var(--huts-ctrl-muted, #555)",
                  }}
                >
                  Checking availability…
                </span>
              )}
            </div>
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
                  background: "#fff",
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
          height: isMobile ? "min(500px, calc(100dvh - 260px))" : "calc(100dvh - 320px)",
          border: isMobile && mapInteractive ? "1px solid #0070f3" : "1px solid #ddd",
          boxShadow:
            isMobile && mapInteractive
              ? "0 0 0 2px rgba(0, 112, 243, 0.2)"
              : undefined,
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
              background: mapInteractive ? "#0070f3" : "rgba(255,255,255,0.95)",
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
              const hasFilters =
                selectedGroups.length > 0 || selectedTours.length > 0;
              const matchesGroup =
                selectedGroups.length > 0 &&
                selectedGroups.includes(h.gebirgsgruppe);
              const tourRole = hutTourRoles.get(h.id) ?? null;
              const matchesTour = tourRole != null;
              const isSelected =
                !hasFilters || matchesGroup || matchesTour;
              const isOfficial = tourRole === "official";
              const isOptional = tourRole === "optional";
              const dimOptional = isOptional && !matchesGroup;
              const inPlan = tourSelectedHuts.find((s) => s.id === h.id);
              const isSoldOut = soldOutFilterHutIds.has(h.id);

              let outline;
              if (inPlan) outline = "3px solid #0070f3";
              else if (isOfficial && !isSoldOut)
                outline = "2px solid rgba(20,20,20,0.55)";
              else if (isOptional && !isSoldOut)
                outline = "2px dashed #c4c4c4";

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
                    isSoldOut
                      ? `${h.name} (no ${bedsNeeded}+ bed night in date range)`
                      : isOfficial
                        ? `${h.name} (official tour hut)`
                        : isOptional
                          ? `${h.name} (optional tour hut)`
                          : h.name
                  }
                  style={{
                    position: "absolute",
                    left: x - (dimOptional ? 6 : 8),
                    top: y - (dimOptional ? 6 : 8),
                    width: dimOptional ? 12 : 16,
                    height: dimOptional ? 12 : 16,
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
                    opacity: !isSelected ? 0.12 : dimOptional ? 0.55 : 1,
                    zIndex: isSelected ? (isOfficial ? 3 : 2) : 1,
                    transition: "opacity 180ms ease, background 180ms ease",
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
          flexWrap: "wrap",
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
        {selectedTours.length > 0 && (
          <>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Core overnight huts on the selected tour(s)"
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#888",
                  border: "2px solid #fff",
                  outline: "2px solid rgba(20,20,20,0.55)",
                  outlineOffset: 1,
                  flexShrink: 0,
                }}
              />
              Official tour hut
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              title="Variant, lunch stop, or nearby extension on the selected tour(s)"
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#888",
                  border: "2px solid #fff",
                  outline: "2px dashed #c4c4c4",
                  outlineOffset: 1,
                  opacity: 0.55,
                  flexShrink: 0,
                }}
              />
              Optional tour hut
            </div>
          </>
        )}
        {soldOutFilterHutIds.size > 0 && (
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
