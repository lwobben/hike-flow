"use client";

import React, { useState } from "react";
import ReactFlow, { MarkerType } from "reactflow";
import "reactflow/dist/style.css";

// Example waypoints with lat/lon and info
const waypoints = [
  { id: "1", name: "Trailhead", lat: 46.0, lon: 7.0, info: "Start of trail" },
  { id: "2", name: "Scenic Overlook", lat: 46.01, lon: 7.02, info: "Beautiful view" },
  { id: "3", name: "Mountain Hut", lat: 46.03, lon: 7.01, info: "Rest stop" },
  { id: "4", name: "Summit", lat: 46.05, lon: 7.03, info: "Peak of mountain" },
];

// Normalize coordinates to canvas
const minLat = Math.min(...waypoints.map((w) => w.lat));
const maxLat = Math.max(...waypoints.map((w) => w.lat));
const minLon = Math.min(...waypoints.map((w) => w.lon));
const maxLon = Math.max(...waypoints.map((w) => w.lon));
const canvasWidth = 800;
const canvasHeight = 600;

const scaleX = (lon) => ((lon - minLon) / (maxLon - minLon)) * canvasWidth;
const scaleY = (lat) => canvasHeight - ((lat - minLat) / (maxLat - minLat)) * canvasHeight;

// Convert waypoints to React Flow nodes
const nodes = waypoints.map((w) => ({
  id: w.id,
  position: { x: scaleX(w.lon), y: scaleY(w.lat) },
  data: { label: w.name, info: w.info },
}));

// Define edges between waypoints
const edges = [
  { id: "e1-2", source: "1", target: "2", animated: true, style: { stroke: "#ff5722" }, markerEnd: { type: MarkerType.Arrow } },
  { id: "e2-3", source: "2", target: "3", animated: true, style: { stroke: "#4caf50" }, markerEnd: { type: MarkerType.Arrow } },
  { id: "e3-4", source: "3", target: "4", animated: true, style: { stroke: "#2196f3" }, markerEnd: { type: MarkerType.Arrow } },
];

const HikingRoute = () => {
  const [hoveredEdge, setHoveredEdge] = useState(null);

  const onEdgeMouseEnter = (e, edge) => setHoveredEdge(edge.id);
  const onEdgeMouseLeave = () => setHoveredEdge(null);
  const onNodeClick = (event, node) => alert(`Clicked on: ${node.data.label}\nInfo: ${node.data.info}`);

  return (
    <div style={{ width: canvasWidth, height: canvasHeight, border: "1px solid #ddd" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges.map((edge) => ({
          ...edge,
          style: hoveredEdge === edge.id ? { ...edge.style, strokeWidth: 4 } : edge.style,
        }))}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeClick={onNodeClick}
        fitView
      />
    </div>
  );
};

export default HikingRoute;
