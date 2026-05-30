import { useState } from "react";
import { Globe } from "lucide-react";

function formatMinutes(minutes) {
  if (minutes == null) return "?";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

const tooltipStyle = {
  position: "absolute",
  left: "calc(100% + 8px)",
  top: 0,
  background: "#fff",
  border: "1px solid #ccc",
  borderRadius: 6,
  padding: "8px 12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  zIndex: 1001,
  minWidth: 220,
  maxWidth: 320,
  fontSize: "0.85em",
  whiteSpace: "normal",
  pointerEvents: "none",
};

export default function HutPopup({ popup, dateFrom, dateTo, showAvailability }) {
  const [hovered, setHovered] = useState(null);
  if (!popup) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
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
            {popup.name}
            {popup.elevation ? ` (${popup.elevation})` : ""}
          </div>
          {popup.gebirgsgruppe && (
            <div
              style={{
                color: "#666",
                fontSize: "0.85em",
                marginBottom: 4,
              }}
            >
              {popup.gebirgsgruppe}
              {popup.bundesland ? ` (${popup.bundesland})` : ""}
            </div>
          )}
          {(popup.link || popup.websites?.length > 0) && (
            <div
              style={{
                fontSize: "0.7em",
                fontWeight: "bold",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              Websites
            </div>
          )}
          {popup.link && (
            <a
              href={popup.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0070f3", display: "block", marginBottom: 4 }}
            >
              • Alpenverein.at
            </a>
          )}
          {popup.websites?.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <span style={{ color: "#444" }}>• Other hut page(s):</span>
              {popup.websites.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={url.replace(/^https?:\/\//, "")}
                  style={{ color: "#0070f3", display: "flex" }}
                >
                  <Globe size={16} />
                </a>
              ))}
            </div>
          )}
          {popup.hutReservationId && (
            <a
              href={`https://www.hut-reservation.org/reservation/book-hut/${popup.hutReservationId}/wizard`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0070f3", display: "block", marginBottom: 4 }}
            >
              • Book →
            </a>
          )}
          {(popup.bahnhof ||
            popup.bushaltestelle ||
            popup.pkw ||
            popup.parkmoeglichkeiten ||
            popup.approaches?.length > 0 ||
            popup.tours?.length > 0) && (
            <div
              style={{
                fontSize: "0.7em",
                fontWeight: "bold",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              Hiking info
            </div>
          )}
          {(popup.bahnhof ||
            popup.bushaltestelle ||
            popup.pkw ||
            popup.parkmoeglichkeiten ||
            popup.approaches?.length > 0) && (
            <div
              style={{ position: "relative", marginBottom: 4 }}
              onMouseEnter={() => setHovered("getting-there")}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ color: "#0070f3", cursor: "default" }}>
                • Getting there
              </span>
              {hovered === "getting-there" && (
                <div style={tooltipStyle}>
                  {[
                    popup.bahnhof && ["• Nearest train station", popup.bahnhof],
                    popup.bushaltestelle && [
                      "• Nearest bus stop",
                      popup.bushaltestelle,
                    ],
                    popup.pkw && ["• Closest point by car", popup.pkw],
                    popup.parkmoeglichkeiten && [
                      "• Parking",
                      popup.parkmoeglichkeiten,
                    ],
                    popup.approaches && ["• Approach routes", ""],
                  ]
                    .filter(Boolean)
                    .map(([label, value]) => (
                      <div key={label} style={{ marginBottom: 4 }}>
                        <span style={{ color: "#666" }}>{label}:</span> {value}
                      </div>
                    ))}
                  {popup.approaches?.length > 0 && (
                    <div
                      style={{
                        marginTop:
                          popup.bahnhof ||
                          popup.bushaltestelle ||
                          popup.pkw ||
                          popup.parkmoeglichkeiten
                            ? 6
                            : 0,
                        paddingLeft: 8,
                      }}
                    >
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: "left",
                                color: "#666",
                                fontWeight: "normal",
                                paddingBottom: 2,
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              From
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                color: "#666",
                                fontWeight: "normal",
                                paddingBottom: 2,
                                borderBottom: "1px solid #eee",
                              }}
                            >
                              Time to hut
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {popup.approaches.map((a) => (
                            <tr key={a.name}>
                              <td style={{ padding: "2px 0" }}>{a.name}</td>
                              <td
                                style={{
                                  textAlign: "right",
                                  color: "#888",
                                  padding: "2px 0",
                                }}
                              >
                                {formatMinutes(a.minutes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {popup.tours?.length > 0 && (
            <div
              style={{ position: "relative", marginBottom: 4 }}
              onMouseEnter={() => setHovered("routes")}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ color: "#0070f3", cursor: "default" }}>
                • Routes (day tours)
              </span>
              {hovered === "routes" && (
                <div style={{ ...tooltipStyle, minWidth: 300 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            color: "#666",
                            fontWeight: "normal",
                            paddingBottom: 4,
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Destination
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            color: "#666",
                            fontWeight: "normal",
                            paddingBottom: 4,
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Time to get there
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {popup.tours.map((t) => (
                        <tr key={t.name}>
                          <td style={{ padding: "2px 0" }}>{t.name}</td>
                          <td
                            style={{
                              textAlign: "right",
                              color: "#888",
                              padding: "2px 0",
                            }}
                          >
                            {formatMinutes(t.minutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {showAvailability && (
            <div
              style={{
                fontSize: "0.7em",
                fontWeight: "bold",
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              Availability
            </div>
          )}
          {showAvailability && !popup.hutReservationId && (
            <div style={{ color: "#999", fontSize: "0.85em" }}>
              Availability not listed online
            </div>
          )}
          {popup.availability && (
            <div style={{ marginTop: 8 }}>
              {popup.availability.loading ? (
                <div style={{ color: "#999", fontSize: "0.85em" }}>
                  Loading availability…
                </div>
              ) : popup.availability.error ? (
                <div style={{ color: "#999", fontSize: "0.85em" }}>
                  Could not load availability
                </div>
              ) : popup.availability.hutUnlocked === false ? (
                <div style={{ color: "#999", fontSize: "0.85em" }}>
                  Profile not activated — book directly with the hut
                </div>
              ) : (
                <>
                  {popup.availability.data
                    .filter((e) => e.date >= dateFrom && e.date <= dateTo)
                    .map((e) => (
                      <div
                        key={e.date}
                        style={{
                          display: "flex",
                          gap: 8,
                          fontSize: "0.85em",
                          padding: "2px 0",
                          color:
                            e.freeBeds == null || e.freeBeds === 0
                              ? "#c00"
                              : e.freeBeds <= 3
                                ? "#e07800"
                                : "#2a7a2a",
                        }}
                      >
                        <span
                          className={
                            e.hutStatus &&
                            e.hutStatus.toLowerCase() !== "serviced"
                              ? "instant-tooltip"
                              : undefined
                          }
                          data-tooltip={e.hutStatus}
                          style={{ width: 14, flexShrink: 0 }}
                        >
                          {e.hutStatus &&
                          e.hutStatus.toLowerCase() !== "serviced"
                            ? "ℹ"
                            : ""}
                        </span>
                        <span style={{ width: 100, flexShrink: 0 }}>
                          {e.date.slice(0, 10)}
                        </span>
                        <span>
                          {e.freeBeds != null ? `${e.freeBeds} beds` : ""}
                        </span>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>
            Walking times
          </div>
          <div style={{ fontSize: "0.9em", marginBottom: 2 }}>
            {popup.fromName}
            {popup.fromElevation ? ` (${popup.fromElevation})` : ""} →{" "}
            {popup.toName}
            {popup.toElevation ? ` (${popup.toElevation})` : ""}:{" "}
            <strong>{formatMinutes(popup.fwdMinutes)}</strong>
          </div>
          <div style={{ fontSize: "0.9em" }}>
            {popup.toName}
            {popup.toElevation ? ` (${popup.toElevation})` : ""} →{" "}
            {popup.fromName}
            {popup.fromElevation ? ` (${popup.fromElevation})` : ""}:{" "}
            <strong>{formatMinutes(popup.revMinutes)}</strong>
          </div>
        </>
      )}
    </div>
  );
}
