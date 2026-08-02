"use client";

import { useState } from "react";
import HutsMap from "./HutsMap/HutsMapClient";
import TourList from "./TourList/TourList";

export default function MapAndTours() {
  const [focusedTourId, setFocusedTourId] = useState(null);

  function viewTourOnMap(tourId) {
    if (focusedTourId === tourId) {
      setFocusedTourId(null);
      return;
    }
    setFocusedTourId(tourId);
    document
      .getElementById("huts-map")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div id="huts-map">
        <HutsMap
          focusedTourId={focusedTourId}
          onFocusedTourChange={setFocusedTourId}
        />
      </div>
      <TourList
        focusedTourId={focusedTourId}
        onViewOnMap={viewTourOnMap}
      />
    </>
  );
}
