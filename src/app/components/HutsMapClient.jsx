"use client";

import dynamic from "next/dynamic";

// Wrapper to disable SSR for maplibre-gl / ReactFlow (browser-only globals)
const HutsMap = dynamic(() => import("./HutsMap"), { ssr: false });

export default function HutsMapClient() {
  return <HutsMap />;
}
