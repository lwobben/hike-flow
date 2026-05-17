import { fetch as undiciFetch, Agent } from "undici";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import vm from "vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");
const agent = new Agent({ connect: { rejectUnauthorized: false } });

export async function fetchHuts() {
  const res = await undiciFetch(
    "https://www.alpenverein.at/huetten/finder/huettendata.js",
    { dispatcher: agent }
  );
  const jsText = await res.text();
  await writeFile(resolve(DATA, "huettendata.js"), jsText, "utf8");
  console.log("data/huettendata.js written");

  const sandbox = { hD: {}, gD: {}, rD: {} };
  vm.createContext(sandbox);
  vm.runInContext(jsText, sandbox, { timeout: 1000 });

  const huts = Object.entries(sandbox.hD).map(([id, hut]) => ({
    id,
    name: hut?.name ?? null,
    elevation: hut?.hoehe ? `${hut.hoehe} m` : null,
    link: `https://www.alpenverein.at/huetten/index.php?huette_nr=${id}`,
    phone: hut?.huette_telefon || null,
    lat: hut?.lat ?? null,
    lon: hut?.lon ?? null,
    gebirgsgruppe: sandbox.gD[hut?.gebirgsgruppe]?.name ?? null,
    bundesland: sandbox.rD[hut?.bundesland]?.name ?? null,
  }));

  await writeFile(resolve(DATA, "huts.json"), JSON.stringify(huts, null, 2), "utf8");
  console.log(`data/huts.json written — ${huts.length} huts`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fetchHuts();
}
