export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hutId = searchParams.get("hutId");

  if (!hutId) {
    return new Response(JSON.stringify({ error: "hutId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `https://www.hut-reservation.org/api/v1/reservation/getHutAvailability?hutId=${hutId}&step=WIZARD`
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch availability" }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await res.json();
  const availability = raw.map((entry) => ({
    date: entry.date,
    freeBeds: entry.freeBeds,
    hutStatus: entry.hutStatus,
    percentage: entry.percentage,
  }));

  return new Response(JSON.stringify(availability), {
    headers: { "Content-Type": "application/json" },
  });
}
