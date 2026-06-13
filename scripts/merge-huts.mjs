import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");

const MAX_EDGE_KM = 50;

function approxKm(lat1, lon1, lat2, lon2) {
  const latMid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dlat = (lat2 - lat1) * 111.0;
  const dlon = (lon2 - lon1) * 111.0 * Math.cos(latMid);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

export async function mergeHuts() {
  const [huts, scraped] = await Promise.all([
    readFile(resolve(DATA, "huts.json"), "utf8").then(JSON.parse),
    readFile(resolve(DATA, "huts-scraped.json"), "utf8").then(JSON.parse),
  ]);

  const scrapedById = Object.fromEntries(scraped.map((h) => [h.id, h]));
  const coordsById = Object.fromEntries(huts.map((h) => [h.id, { lat: h.lat, lon: h.lon }]));

  let droppedEdges = 0;
  const combined = huts.map((hut) => {
    const { id: _id, ...scrapedFields } = scrapedById[hut.id] ?? {};
    if (scrapedFields.edges && hut.lat && hut.lon) {
      scrapedFields.edges = scrapedFields.edges.filter((edge) => {
        const dst = coordsById[edge.to];
        if (!dst?.lat || !dst?.lon) return true;
        const km = approxKm(hut.lat, hut.lon, dst.lat, dst.lon);
        if (km > MAX_EDGE_KM) { droppedEdges++; return false; }
        return true;
      });
    }
    return { ...hut, ...scrapedFields };
  });
  if (droppedEdges > 0) console.log(`Dropped ${droppedEdges} edges exceeding ${MAX_EDGE_KM} km`);

  await writeFile(
    resolve(DATA, "huts-combined.json"),
    JSON.stringify(combined, null, 2),
    "utf8",
  );
  console.log(`huts-combined.json written — ${combined.length} huts`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mergeHuts();
}
