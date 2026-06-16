"use client";

import React, { useState, useEffect } from "react";
import { Globe } from "lucide-react";

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid #ddd",
        borderTopColor: "#555",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}

function getDateRange(from, to) {
  if (!from || !to || from > to) return [];
  const dates = [];
  const cur = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cur <= end && dates.length < 183) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function CellContent({ avail, date, bedsNeeded }) {
  if (!avail) return <span style={{ color: "#ccc" }}>-</span>;
  if (avail.notBookable)
    return <span style={{ color: "#f97316", fontWeight: 700 }}>?</span>;
  if (avail.loading) return <Spinner />;
  if (avail.error) return <span style={{ color: "#bbb" }}>-</span>;
  if (!avail.hutUnlocked)
    return <span style={{ color: "#bbb", fontSize: "0.7em" }}>locked</span>;

  const entry = avail.data?.find((e) => e.date.slice(0, 10) === date);
  if (!entry) return <span style={{ color: "#bbb" }}>-</span>;

  const beds = entry.freeBeds;
  const ok = beds != null && beds >= bedsNeeded;

  return (
    <span
      style={{
        background: ok ? "#dcfce7" : "#fee2e2",
        color: ok ? "#166534" : "#991b1b",
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: "0.85em",
        fontWeight: 600,
      }}
    >
      {beds ?? 0}
    </span>
  );
}

function formatColHeader(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dayAbbr = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()];
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { dayAbbr, date };
}

export default function PlanTourModal({
  dateFrom,
  dateTo,
  onClose,
  selectedHuts,
  onSelectedHutsChange,
  bedsNeeded,
}) {
  const [step, setStep] = useState("setup");
  const [availability, setAvailability] = useState({});
  const [linkTooltip, setLinkTooltip] = useState(null);

  function removeHut(uid) {
    onSelectedHutsChange(selectedHuts.filter((h) => h._uid !== uid));
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const next = [...selectedHuts];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onSelectedHutsChange(next);
  }

  function moveDown(idx) {
    if (idx === selectedHuts.length - 1) return;
    const next = [...selectedHuts];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onSelectedHutsChange(next);
  }

  const dates = getDateRange(dateFrom, dateTo);
  const totalDays =
    dateFrom && dateTo
      ? Math.round(
          (new Date(dateTo + "T00:00:00") -
            new Date(dateFrom + "T00:00:00")) /
            86400000
        ) + 1
      : 0;
  const dateRangeValid = dates.length > 0;

  useEffect(() => {
    if (step !== "matrix") return;

    const additions = {};
    const toFetch = [];

    for (const h of selectedHuts) {
      if (h.id in availability) continue;
      if (!h.hutReservationId) {
        additions[h.id] = { loading: false, notBookable: true };
      } else {
        additions[h.id] = { loading: true };
        toFetch.push(h);
      }
    }

    if (Object.keys(additions).length === 0 && toFetch.length === 0) return;

    setAvailability((prev) => ({ ...prev, ...additions }));

    const fetched = new Set();
    for (const h of toFetch) {
      if (fetched.has(h.id)) continue;
      fetched.add(h.id);
      fetch(`/api/availability?hutId=${h.hutReservationId}`)
        .then((r) => r.json())
        .then((res) =>
          setAvailability((prev) => ({
            ...prev,
            [h.id]: {
              loading: false,
              hutUnlocked: res.hutUnlocked ?? true,
              data: Array.isArray(res.availability) ? res.availability : [],
            },
          }))
        )
        .catch(() =>
          setAvailability((prev) => ({
            ...prev,
            [h.id]: { loading: false, error: true },
          }))
        );
    }
  }, [step, selectedHuts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        width: "100%",
        background: "var(--huts-ctrl-bg, #fff)",
        border: "1px solid var(--huts-ctrl-border, #ddd)",
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        marginBottom: 8,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid var(--huts-ctrl-border, #eee)",
          background: "var(--huts-ctrl-bg-alt, #fafafa)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9em" }}>
            {step === "setup" ? "Plan tour" : "Availability Overview"}
          </span>
          {step === "setup" && (
            <span style={{ color: "#999", fontSize: "0.78em" }}>
              Click huts on the map or use the search above
            </span>
          )}
          {step === "matrix" && (
            <button
              onClick={() => setStep("setup")}
              style={{
                background: "none",
                border: "1px solid #ccc",
                borderRadius: 4,
                padding: "2px 10px",
                cursor: "pointer",
                fontSize: "0.78em",
                color: "#555",
              }}
            >
              ← Back
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.2em",
            cursor: "pointer",
            color: "#888",
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: 4,
          }}
          title="Close"
        >
          &#x2715;
        </button>
      </div>

      {/* Setup step */}
      {step === "setup" && (
        <div style={{ padding: "14px 16px" }}>
          <div>
            {selectedHuts.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: "0.78em",
                    color: "#888",
                    marginBottom: 5,
                  }}
                >
                  Tour order — {selectedHuts.length} hut
                  {selectedHuts.length !== 1 ? "s" : ""} selected
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 120,
                    overflowY: "auto",
                  }}
                >
                  {selectedHuts.map((h, idx) => (
                    <div
                      key={h._uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#f0f7ff",
                        border: "1px solid #c7dffb",
                        borderRadius: 4,
                        padding: "3px 8px",
                        fontSize: "0.8em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ color: "#999", fontSize: "0.85em" }}>
                        {idx + 1}.
                      </span>
                      <span>{h.name}</span>
                      {!h.hutReservationId && (
                        <span style={{ color: "#ccc", fontSize: "0.8em" }}>(direct)</span>
                      )}
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: idx === 0 ? "default" : "pointer",
                          color: idx === 0 ? "#ccc" : "#555",
                          fontSize: "0.75em",
                          padding: "0 1px",
                          lineHeight: 1,
                        }}
                        title="Move earlier"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === selectedHuts.length - 1}
                        style={{
                          background: "none",
                          border: "none",
                          cursor:
                            idx === selectedHuts.length - 1
                              ? "default"
                              : "pointer",
                          color:
                            idx === selectedHuts.length - 1 ? "#ccc" : "#555",
                          fontSize: "0.75em",
                          padding: "0 1px",
                          lineHeight: 1,
                        }}
                        title="Move later"
                      >
                        ▶
                      </button>
                      <button
                        onClick={() => removeHut(h._uid)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#aaa",
                          fontSize: "0.9em",
                          padding: "0 1px",
                          lineHeight: 1,
                        }}
                        title="Remove"
                      >
                        &#x2715;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: "#bbb", fontSize: "0.8em", margin: "0 0 10px" }}>
                Click huts on the map or use the search above to add them.
              </p>
            )}
          </div>

          <button
            onClick={() => setStep("matrix")}
            disabled={selectedHuts.length === 0 || !dateRangeValid}
            style={{
              marginTop: 12,
              padding: "7px 20px",
              background:
                selectedHuts.length === 0 || !dateRangeValid ? "#ccc" : "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor:
                selectedHuts.length === 0 || !dateRangeValid ? "default" : "pointer",
              fontWeight: 600,
              fontSize: "0.85em",
            }}
          >
            Show Availability
          </button>
        </div>
      )}

      {linkTooltip && (
        <div
          style={{
            position: "fixed",
            left: linkTooltip.x + 14,
            top: linkTooltip.y - 30,
            background: "#333",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: "0.75em",
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
            maxWidth: 320,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {linkTooltip.text}
        </div>
      )}

      {/* Matrix step */}
      {step === "matrix" && (
        <div style={{ padding: "12px 16px" }}>
          <div
            style={{
              fontSize: "0.78em",
              color: "var(--huts-ctrl-muted, #777)",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span>
              {dateFrom} – {dateTo} &middot; {bedsNeeded} bed
              {bedsNeeded !== 1 ? "s" : ""} needed
            </span>
            {totalDays > 183 && (
              <span
                style={{
                  color: "#854d0e",
                  background: "#fef9c3",
                  padding: "2px 8px",
                  borderRadius: 3,
                }}
              >
                Showing first 183 of {totalDays} days
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                fontSize: "0.8em",
                minWidth: "100%",
              }}
            >
              <thead
                style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--huts-ctrl-bg, #fff)" }}
              >
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "5px 10px",
                      borderBottom: "2px solid #e5e5e5",
                      whiteSpace: "nowrap",
                      minWidth: 160,
                      position: "sticky",
                      left: 0,
                      background: "var(--huts-ctrl-bg, #fff)",
                    }}
                  >
                    Hut
                  </th>
                  {dates.map((d) => {
                    const { dayAbbr, date } = formatColHeader(d);
                    return (
                      <th
                        key={d}
                        style={{
                          padding: "4px 3px",
                          borderBottom: "2px solid #e5e5e5",
                          textAlign: "center",
                          fontWeight: 600,
                          minWidth: 40,
                          lineHeight: 1.3,
                        }}
                      >
                        <div style={{ color: "#aaa", fontWeight: 400, fontSize: "0.85em" }}>{dayAbbr}</div>
                        <div style={{ color: "#555", whiteSpace: "nowrap" }}>{date}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {selectedHuts.map((h, idx) => {
                  const avail = availability[h.id];
                  return (
                    <tr
                      key={h._uid}
                      style={{ background: idx % 2 === 0 ? "var(--huts-ctrl-bg-alt, #fafafa)" : "var(--huts-ctrl-bg, #fff)" }}
                    >
                      <td
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid #eee",
                          position: "sticky",
                          left: 0,
                          background: idx % 2 === 0 ? "var(--huts-ctrl-bg-alt, #fafafa)" : "var(--huts-ctrl-bg, #fff)",
                          zIndex: 1,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 600,
                          }}
                          title={h.name}
                        >
                          {h.name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            marginTop: 2,
                            alignItems: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ color: "#bbb", fontSize: "0.82em" }}>
                            {h.elevation}
                          </span>
                          {(h.link || h.websites?.length > 0) && (
                            <>
                              <span style={{ color: "#aaa", fontSize: "0.9em" }}>·</span>
                              {h.link && (
                                <a
                                  href={h.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#16a34a", display: "flex", alignItems: "center" }}
                                  onMouseEnter={(e) => setLinkTooltip({ text: "Alpenverein.at", x: e.clientX, y: e.clientY })}
                                  onMouseMove={(e) => setLinkTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
                                  onMouseLeave={() => setLinkTooltip(null)}
                                >
                                  <Globe size={11} />
                                </a>
                              )}
                              {h.websites?.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#555", display: "flex", alignItems: "center" }}
                                  onMouseEnter={(e) => setLinkTooltip({ text: url.replace(/^https?:\/\//, ""), x: e.clientX, y: e.clientY })}
                                  onMouseMove={(e) => setLinkTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
                                  onMouseLeave={() => setLinkTooltip(null)}
                                >
                                  <Globe size={11} />
                                </a>
                              ))}
                            </>
                          )}
                          {h.hutReservationId &&
                            avail &&
                            !avail.loading &&
                            !avail.error &&
                            avail.hutUnlocked && (
                              <>
                                <span style={{ color: "#aaa", fontSize: "0.9em" }}>·</span>
                                <a
                                  href={`https://www.hut-reservation.org/reservation/book-hut/${h.hutReservationId}/wizard`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#0070f3",
                                    fontSize: "0.82em",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Book
                                </a>
                              </>
                            )}
                          {!h.hutReservationId && (
                            <>
                              <span style={{ color: "#aaa", fontSize: "0.9em" }}>·</span>
                              <span style={{ color: "#ccc", fontSize: "0.78em" }}>
                                direct booking
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      {dates.map((d) => (
                        <td
                          key={d}
                          style={{
                            padding: "6px 3px",
                            borderBottom: "1px solid #eee",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          <CellContent
                            avail={avail}
                            date={d}
                            bedsNeeded={bedsNeeded}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 10,
              fontSize: "0.75em",
              color: "#666",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 2,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              {bedsNeeded}+ beds available
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: 2,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              Fewer than {bedsNeeded}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
