function formatMinutes(minutes) {
  if (minutes == null) return "unknown";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default function HutPopup({ popup, dateFrom, dateTo }) {
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
          {popup.link && (
            <a
              href={popup.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#0070f3",
                display: "block",
                marginBottom: 4,
              }}
            >
              • View Alpenverein.at page
            </a>
          )}
          {popup.websites?.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#0070f3",
                display: "block",
                marginBottom: 4,
              }}
            >
              {url.replace(/^https?:\/\//, "")} →
            </a>
          ))}
          {popup.hutReservationId && !popup.availability ? (
            <a
              href={`https://www.hut-reservation.org/reservation/book-hut/${popup.hutReservationId}/wizard`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0070f3", display: "block" }}
            >
              View availability →
            </a>
          ) : popup.availability ? (
            <div style={{ marginTop: 8 }}>
              {popup.availability.loading ? (
                <div style={{ color: "#999", fontSize: "0.85em" }}>
                  Loading availability…
                </div>
              ) : popup.availability.error ? (
                <div style={{ color: "#999", fontSize: "0.85em" }}>
                  Could not load availability
                </div>
              ) : (
                <>
                  <a
                    href={`https://www.hut-reservation.org/reservation/book-hut/${popup.hutReservationId}/wizard`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#0070f3",
                      display: "block",
                      fontSize: "0.85em",
                      marginTop: 4,
                    }}
                  >
                    Book →
                  </a>
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
          ) : (
            <div style={{ color: "#999", fontSize: "0.85em" }}>
              Availability not listed online
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
