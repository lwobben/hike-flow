import { fetch as undiciFetch, Agent } from "undici";
import { writeFile, readFile } from "fs/promises";
import { load } from "cheerio";
import vm from "vm";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "data");
const agent = new Agent({ connect: { rejectUnauthorized: false } });

function parseMinutes(str) {
  const match = str?.match(/(\d+):(\d+)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

async function scrapeNeighbors(hutId) {
  const url = `https://www.alpenverein.at/huetten/index.php?huette_nr=${hutId}`;
  try {
    const res = await undiciFetch(url, { dispatcher: agent });
    const html = await res.text();
    const $ = load(html);
    const edges = [];

    $('a[href*="huette_nr="]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/huette_nr=(\d+)/);
      if (!match || match[1] === hutId) return;

      const toId = match[1];
      const gehzeitText = $(el).parent().nextAll("em, i").first().text();
      const g = gehzeitText.match(/Gehzeit[:\s]+(\d+:\d+)/i);
      const minutes = g ? parseMinutes(g[1]) : null;

      edges.push({ from: hutId, to: toId, minutes });
    });

    return edges;
  } catch (err) {
    console.error(`Skipping hut ${hutId}: ${err.message}`);
    return [];
  }
}

export async function buildGraph() {
  const jsText = await readFile(resolve(DATA, "huettendata.js"), "utf8");
  const sandbox = { hD: {} };
  vm.createContext(sandbox);
  vm.runInContext(jsText, sandbox, { timeout: 5000 });

  const hutIds = Object.keys(sandbox.hD);
  const edges = [];

  for (let i = 0; i < hutIds.length; i++) {
    const hutEdges = await scrapeNeighbors(hutIds[i]);
    edges.push(...hutEdges);
    if (i % 50 === 0) console.log(`Scraping: ${i}/${hutIds.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  await writeFile(
    resolve(DATA, "graph.json"),
    JSON.stringify(edges, null, 2),
    "utf8",
  );
  console.log(`graph.json written — ${edges.length} edges`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildGraph();
}
