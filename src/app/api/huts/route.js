import { fetch as undiciFetch, Agent } from "undici";
import { writeFile } from "fs/promises";
import vm from "vm";

export async function GET() {
  const res = await undiciFetch(
    "https://www.alpenverein.at/huetten/finder/huettendata.js",
    {
      dispatcher: new Agent({
        connect: { rejectUnauthorized: false },
      }),
    },
  );

  const jsText = await res.text();
  // console.log(jsText);

  await writeFile("huettendata.js", jsText, "utf8");

  const sandbox = { hD: {}, gD: {}, rD: {} };
  vm.createContext(sandbox);

  try {
    vm.runInContext(jsText, sandbox, { timeout: 1000 });
  } catch (err) {
    console.error("VM execution failed:", err);
    throw err; // bubble up so your framework returns a 500
  }

  // Now sandbox.hD should contain all hut objects keyed by id
  const realHuts = Object.entries(sandbox.hD).map(([id, hut]) => ({
    id,
    name: hut?.name ?? null,
    elevation: hut?.hoehe ? `${hut.hoehe} m` : null,
    // use the hD key (id) as the reservation huette_nr
    link: `https://www.alpenverein.at/huetten/index.php?huette_nr=${id}`,
    phone: hut?.huette_telefon || null,
    lat: hut?.lat ?? null,
    lon: hut?.lon ?? null,
    gebirgsgruppe: sandbox.gD[hut?.gebirgsgruppe]?.name ?? null,
    bundesland: sandbox.rD[hut?.bundesland]?.name ?? null,
  }));

  return new Response(JSON.stringify(realHuts), {
    headers: { "Content-Type": "application/json" },
  });
}
