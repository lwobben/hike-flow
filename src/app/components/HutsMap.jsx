"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import ReactFlow from "reactflow";
import "reactflow/dist/style.css";

const PALETTE = [
  "#e6194b","#3cb44b","#4363d8","#f58231","#911eb4",
  "#42d4f4","#f032e6","#bfef45","#fabed4","#469990",
  "#dcbeff","#9a6324","#fffac8","#800000","#aaffc3",
  "#808000","#ffd8b1","#000075","#a9a9a9","#e6beff",
];

const DotNode = ({ data }) => (
  <div
    style={{
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: data.color,
      border: "2px solid #fff",
      cursor: "pointer",
      pointerEvents: "auto",
    }}
  />
);

const nodeTypes = { dot: DotNode };

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
  if (len === 0) return [[from.lon, from.lat], [to.lon, to.lat]];

  const sign = from.id < to.id ? 1 : -1;
  const amplitude = len * 0.25;
  const cx = (from.lon + to.lon) / 2 + (-dLat / len) * amplitude * sign;
  const cy = (from.lat + to.lat) / 2 + (dLon / len) * amplitude * sign;

  const steps = 8;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = (1 - t) * (1 - t) * from.lon + 2 * (1 - t) * t * cx + t * t * to.lon;
    const lat = (1 - t) * (1 - t) * from.lat + 2 * (1 - t) * t * cy + t * t * to.lat;
    points.push([lon, lat]);
  }
  return points;
}

function formatMinutes(minutes) {
  if (minutes == null) return "unknown";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default function HutsMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const hutsRef = useRef([]);
  const hutsByIdRef = useRef({});
  const edgesByKeyRef = useRef({});
  const groupColorMap = useRef({});
  const mapLoadedRef = useRef(false);
  const graphRef = useRef(null);
  const animFrameRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);

  const projectHuts = useCallback(() => {
    const map = mapRef.current;
    if (!map || hutsRef.current.length === 0) return;
    setNodes(
      hutsRef.current.map((h, i) => {
        const { x, y } = map.project([h.lon, h.lat]);
        return {
          id: String(i),
          type: "dot",
          position: { x: x - 8, y: y - 8 },
          data: {
            label: "",
            name: h.name,
            elevation: h.elevation,
            link: h.link,
            gebirgsgruppe: h.gebirgsgruppe,
            bundesland: h.bundesland,
            color: groupColorMap.current[h.gebirgsgruppe] ?? "#aaa",
          },
          style: { background: "transparent", border: "none", width: 16, height: 16 },
        };
      })
    );
  }, []);

  const addEdgeLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !graphRef.current) return;

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
        [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
        [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
        [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
        [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
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
          map.setPaintProperty("edges-layer", "line-dasharray", dashSequence[newStep]);
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
        setPopup({
          type: "edge",
          fromName: fromHut?.name ?? from,
          fromElevation: fromHut?.elevation ?? null,
          toName: toHut?.name ?? to,
          toElevation: toHut?.elevation ?? null,
          fwdMinutes: fwd ?? null,
          revMinutes: rev ?? null,
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
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
        projectHuts();
        addEdgeLayer();
      })
      .finally(() => setLoading(false));
  }, [projectHuts, addEdgeLayer]);

  // Fetch graph
  useEffect(() => {
    fetch("/api/graph")
      .then((res) => res.json())
      .then((edges) => {
        graphRef.current = edges;
        const lookup = {};
        for (const e of edges) lookup[`${e.from}-${e.to}`] = e.minutes;
        edgesByKeyRef.current = lookup;
        addEdgeLayer();
      });
  }, [addEdgeLayer]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [13.4, 47.2],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;
      projectHuts();
      addEdgeLayer();
    });
    map.on("move", projectHuts);
    map.on("click", () => setPopup(null));

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, [projectHuts, addEdgeLayer]);

  return (
    <div style={{ position: "relative", width: 800, height: 600, border: "1px solid #ddd" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {loading && (
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.8)", padding: "4px 8px", borderRadius: 4, fontSize: "0.85em" }}>
          Loading huts…
        </div>
      )}

      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          onNodeClick={(event, node) => {
            setPopup({
              type: "hut",
              name: node.data.name,
              elevation: node.data.elevation,
              link: node.data.link,
              gebirgsgruppe: node.data.gebirgsgruppe,
              bundesland: node.data.bundesland,
              x: event.clientX,
              y: event.clientY,
            });
          }}
          style={{ pointerEvents: "none" }}
        />
      </div>

      {popup && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: popup.y + 10,
            left: popup.x + 10,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "8px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
            pointerEvents: "auto",
            cursor: "default",
            minWidth: 180,
          }}
        >
          {popup.type === "hut" ? (
            <>
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                {popup.name}{popup.elevation ? ` (${popup.elevation})` : ""}
              </div>
              {popup.gebirgsgruppe && (
                <div style={{ color: "#666", fontSize: "0.85em", marginBottom: 4 }}>
                  {popup.gebirgsgruppe}{popup.bundesland ? ` (${popup.bundesland})` : ""}
                </div>
              )}
              {popup.link && (
                <a href={popup.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>
                  View hut page →
                </a>
              )}
            </>
          ) : (
            <>
              <div style={{ fontWeight: "bold", marginBottom: 6 }}>Walking times</div>
              <div style={{ fontSize: "0.9em", marginBottom: 2 }}>
                {popup.fromName}{popup.fromElevation ? ` (${popup.fromElevation})` : ""} →{" "}
                {popup.toName}{popup.toElevation ? ` (${popup.toElevation})` : ""}:{" "}
                <strong>{formatMinutes(popup.fwdMinutes)}</strong>
              </div>
              <div style={{ fontSize: "0.9em" }}>
                {popup.toName}{popup.toElevation ? ` (${popup.toElevation})` : ""} →{" "}
                {popup.fromName}{popup.fromElevation ? ` (${popup.fromElevation})` : ""}:{" "}
                <strong>{formatMinutes(popup.revMinutes)}</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
