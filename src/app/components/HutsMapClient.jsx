"use client";

import dynamic from "next/dynamic";

const HutsMap = dynamic(() => import("./HutsMap"), { ssr: false });

export default function HutsMapClient() {
  return <HutsMap />;
}
