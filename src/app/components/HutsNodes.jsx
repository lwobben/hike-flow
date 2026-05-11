"use client";

import React, { useEffect, useState } from "react";
import ReactFlow, { useStore } from "reactflow";
import "reactflow/dist/style.css";

const canvasWidth = 800;
const canvasHeight = 600;

const PALETTE = [
  "#e6194b","#3cb44b","#4363d8","#f58231","#911eb4",
  "#42d4f4","#f032e6","#bfef45","#fabed4","#469990",
  "#dcbeff","#9a6324","#fffac8","#800000","#aaffc3",
  "#808000","#ffd8b1","#000075","#a9a9a9","#e6beff",
];

const DotNode = ({ data }) => {
  const zoom = useStore((s) => s.transform[2]);
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: data.color,
        border: "2px solid #fff",
        cursor: "pointer",
        transform: `scale(${1 / zoom})`,
        transformOrigin: "center",
      }}
    />
  );
};

const nodeTypes = { dot: DotNode };

function buildNodes(huts) {
  const lats = huts.map((h) => h.lat);
  const lons = huts.map((h) => h.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const scaleX = (lon) => ((lon - minLon) / (maxLon - minLon)) * canvasWidth;
  const scaleY = (lat) =>
    canvasHeight - ((lat - minLat) / (maxLat - minLat)) * canvasHeight;

  const groupColorMap = {};
  let colorIndex = 0;
  for (const h of huts) {
    if (h.gebirgsgruppe && !(h.gebirgsgruppe in groupColorMap)) {
      groupColorMap[h.gebirgsgruppe] = PALETTE[colorIndex++ % PALETTE.length];
    }
  }

  return huts.map((h, i) => ({
    id: String(i),
    type: "dot",
    position: { x: scaleX(h.lon), y: scaleY(h.lat) },
    data: {
      label: "",
      name: h.name,
      link: h.link,
      gebirgsgruppe: h.gebirgsgruppe,
      color: groupColorMap[h.gebirgsgruppe] ?? "#aaa",
    },
    style: { background: "transparent", border: "none", width: 16, height: 16 },
  }));
}

export default function HutsNodes() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    fetch("/api/huts")
      .then((res) => res.json())
      .then((data) => {
        const valid = (data || []).filter((h) => h.lat && h.lon);
        setNodes(buildNodes(valid));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading huts map...</p>;
  if (nodes.length === 0) return <p>No hut coordinates found.</p>;

  return (
    <div style={{ position: "relative", width: canvasWidth, height: canvasHeight, border: "1px solid #ddd" }}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodeClick={(event, node) => {
          setPopup({ name: node.data.name, link: node.data.link, gebirgsgruppe: node.data.gebirgsgruppe, x: event.clientX, y: event.clientY });
        }}
        onPaneClick={() => setPopup(null)}
        fitView
        maxZoom={20}
      />
      {popup && (
        <div
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
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>{popup.name}</div>
          {popup.gebirgsgruppe && (
            <div style={{ color: "#666", fontSize: "0.85em", marginBottom: 4 }}>{popup.gebirgsgruppe}</div>
          )}
          {popup.link && (
            <a href={popup.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>
              View hut page →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
