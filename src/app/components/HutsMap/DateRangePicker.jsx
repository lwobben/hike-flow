"use client";

import React, { useState, useRef, useEffect } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTrigger(from, to) {
  if (!from) return "Select dates";
  const fmt = (s) => {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  return to && to !== from ? `${fmt(from)} – ${fmt(to)}` : `${fmt(from)} – ?`;
}

function buildGrid(year, month) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const today = toLocalYMD(new Date());

  const initView = () => {
    const base = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  };

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("from"); // "from" | "to"
  const [pendingFrom, setPendingFrom] = useState(null);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(initView);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setStage("from");
        setPendingFrom(null);
        setHover(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPicker() {
    setStage("from");
    setPendingFrom(null);
    setHover(null);
    setView(initView());
    setOpen(true);
  }

  function prevMonth() {
    setView(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  }
  function nextMonth() {
    setView(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  }

  function handleDayClick(dateStr) {
    if (stage === "from") {
      setPendingFrom(dateStr);
      setStage("to");
    } else {
      const from = pendingFrom;
      const to = dateStr;
      if (to < from) {
        onChange(to, from);
      } else {
        onChange(from, to);
      }
      setPendingFrom(null);
      setStage("from");
      setHover(null);
      setOpen(false);
    }
  }

  // What range to highlight in the calendar
  const highlightFrom = stage === "to" ? pendingFrom : dateFrom;
  const highlightTo =
    stage === "to"
      ? hover ?? null
      : dateTo;

  function rangeState(dateStr) {
    if (!highlightFrom) return "none";
    const f = highlightFrom;
    const t = highlightTo;
    const isF = dateStr === f;
    const isT = t && dateStr === t && t !== f;
    const between = t && dateStr > Math.min(f, t) && dateStr < Math.max(f, t);
    // eslint-disable-next-line no-nested-ternary
    if (isF || (t && dateStr === Math.min(f, t) && f !== t)) return "start";
    if (isT || (t && dateStr === Math.max(f, t) && f !== t)) return "end";
    if (between) return "mid";
    if (isF && (!t || f === t)) return "single";
    return "none";
  }

  const grid = buildGrid(view.year, view.month);

  const triggerLabel =
    stage === "to" && pendingFrom
      ? `${pendingFrom} – ?`
      : formatTrigger(dateFrom, dateTo);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={openPicker}
        style={{
          padding: "4px 10px",
          border: "1px solid var(--huts-ctrl-border, #ccc)",
          borderRadius: 4,
          background: "var(--huts-ctrl-bg, #fff)",
          cursor: "pointer",
          fontSize: "0.85em",
          color: "var(--huts-ctrl-text, #333)",
          whiteSpace: "nowrap",
        }}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--huts-dropdown-bg, #fff)",
            border: "1px solid var(--huts-dropdown-border, #ddd)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            padding: "14px 16px",
            zIndex: 3000,
            width: 268,
          }}
        >
          {/* Month navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <button onClick={prevMonth} style={navBtn}>&#8249;</button>
            <span style={{ fontWeight: 600, fontSize: "0.88em" }}>
              {MONTH_NAMES[view.month]} {view.year}
            </span>
            <button onClick={nextMonth} style={navBtn}>&#8250;</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: "0.72em",
                  color: "var(--huts-ctrl-faint, #aaa)",
                  paddingBottom: 4,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {grid.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const state = rangeState(dateStr);
              const isToday = dateStr === today;

              let bg = "transparent";
              let color = "var(--huts-ctrl-text, #333)";
              let borderRadius = "50%";

              if (state === "start" || state === "single") {
                bg = "#0070f3";
                color = "#fff";
                borderRadius = "50%";
              } else if (state === "end") {
                bg = "#0070f3";
                color = "#fff";
                borderRadius = "50%";
              } else if (state === "mid") {
                bg = "var(--huts-calendar-mid-bg, #dbeafe)";
                color = "var(--huts-calendar-mid-text, #1d4ed8)";
                borderRadius = "0";
              }

              return (
                <div
                  key={i}
                  onClick={() => handleDayClick(dateStr)}
                  onMouseEnter={() => stage === "to" && setHover(dateStr)}
                  onMouseLeave={() => stage === "to" && setHover(null)}
                  style={{
                    textAlign: "center",
                    padding: "5px 0",
                    cursor: "pointer",
                    fontSize: "0.82em",
                    position: "relative",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 28,
                      height: 28,
                      lineHeight: "28px",
                      borderRadius,
                      background: bg,
                      color,
                      fontWeight: isToday ? 700 : 400,
                      outline: isToday && state === "none" ? "1px solid #0070f3" : "none",
                      outlineOffset: -1,
                    }}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hint */}
          <div
            style={{
              marginTop: 10,
              fontSize: "0.72em",
              color: "var(--huts-ctrl-faint, #aaa)",
              textAlign: "center",
            }}
          >
            {stage === "from" ? "Click to set start date" : "Click to set end date"}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "1.3em",
  color: "var(--huts-ctrl-muted, #555)",
  padding: "2px 8px",
  lineHeight: 1,
  borderRadius: 4,
};
