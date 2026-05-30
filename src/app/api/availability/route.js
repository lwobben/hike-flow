export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hutId = searchParams.get("hutId");

  if (!hutId) {
    return new Response(JSON.stringify({ error: "hutId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [availRes, infoRes] = await Promise.all([
    fetch(`https://www.hut-reservation.org/api/v1/reservation/getHutAvailability?hutId=${hutId}&step=WIZARD`),
    fetch(`https://www.hut-reservation.org/api/v1/reservation/hutInfo/${hutId}`),
  ]);

  if (!availRes.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch availability" }), {
      status: availRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [raw, info] = await Promise.all([availRes.json(), infoRes.ok ? infoRes.json() : {}]);

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
}
