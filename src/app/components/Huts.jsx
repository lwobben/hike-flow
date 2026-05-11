"use client";

import { useEffect, useState } from "react";

export default function Huts() {
  const [huts, setHuts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/huts")
      .then((res) => res.json())
      .then((data) => setHuts(data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading huts...</p>;
  }

  if (huts.length === 0) {
    return <p>No huts found.</p>;
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h3>🏔️ Alpenverein Huts</h3>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {huts.map((hut) => (
          <li key={hut.name} style={{ marginBottom: "0.5rem" }}>
            {hut.link ? (
              <a
                href={hut.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0070f3", textDecoration: "underline" }}
              >
                {hut.name}
              </a>
            ) : (
              <span>{hut.name}</span>
            )}{" "}
            {hut.elevation && (
              <span style={{ color: "#666", fontSize: "0.9em" }}>
                ({hut.elevation})
              </span>
            )}{" "}
            {hut.lat && hut.lon && (
              <span style={{ color: "#666", fontSize: "0.9em" }}>
                ({hut.lat}, {hut.lon})
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
