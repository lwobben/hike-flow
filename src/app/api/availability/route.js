import { Agent } from "undici";

// Corporate SSL interception often breaks Node's trust store locally.
// Production (e.g. Vercel) is unaffected; only skip verify in development.
const localAgent =
  process.env.NODE_ENV === "development"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

function hutFetch(url) {
  return fetch(url, localAgent ? { dispatcher: localAgent } : undefined);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hutId = searchParams.get("hutId");

  if (!hutId) {
    return new Response(JSON.stringify({ error: "hutId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const [availRes, infoRes] = await Promise.all([
      hutFetch(
        `https://www.hut-reservation.org/api/v1/reservation/getHutAvailability?hutId=${hutId}&step=WIZARD`,
      ),
      hutFetch(
        `https://www.hut-reservation.org/api/v1/reservation/hutInfo/${hutId}`,
      ),
    ]);

    if (!availRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch availability" }),
        {
          status: availRes.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const [raw, info] = await Promise.all([
      availRes.json(),
      infoRes.ok ? infoRes.json() : {},
    ]);

    if (!Array.isArray(raw)) {
      return new Response(
        JSON.stringify({ error: "Unexpected availability response" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const hutUnlocked = info.hutUnlocked ?? true;
    const availability = raw.map((entry) => ({
      date: entry.date,
      freeBeds: entry.freeBeds,
      hutStatus: entry.hutStatus,
      percentage: entry.percentage,
    }));

    return new Response(JSON.stringify({ hutUnlocked, availability }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const cause = err?.cause;
    const code = cause?.code || err?.code;
    console.error("availability fetch failed", code || err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch availability",
        code: code || undefined,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
