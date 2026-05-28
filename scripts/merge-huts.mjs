import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");

export async function mergeHuts() {
  const [huts, scraped] = await Promise.all([
    readFile(resolve(DATA, "huts.json"), "utf8").then(JSON.parse),
    readFile(resolve(DATA, "huts-scraped.json"), "utf8").then(JSON.parse),
  ]);

  const scrapedById = Object.fromEntries(scraped.map((h) => [h.id, h]));

  const combined = huts.map((hut) => {
    const { id: _id, ...scrapedFields } = scrapedById[hut.id] ?? {};
    return { ...hut, ...scrapedFields };
  });

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
