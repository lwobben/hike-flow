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

function rowText($, id) {
  const td = $(`#${id} td`).eq(1).clone();
  td.find("a").remove();
  const text = td.text().replace(/\s+/g, " ").trim();
  return text || null;
}

function parseTourEntries($, id) {
  const td = $(`#${id} td`).eq(1);
  if (!td.length) return [];
  const entries = [];
  const chunks = td.html().split(/<br\s*\/?>\s*<br\s*\/?>/i);
  for (const chunk of chunks) {
    const nameMatch = chunk.match(/<strong>([^<]+)<\/strong>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;
    const g = chunk.match(/Gehzeit[:\s]+(\d+:\d+)/i);
    entries.push({ name, minutes: g ? parseMinutes(g[1]) : null });
  }
  return entries;
}

function scrapeHutPage(hutId, $) {
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

  const websites = ["#huette_homepage a", "#huette_homepage2 a"]
    .map((sel) => $(sel).first().attr("href") ?? "")
    .filter((h) => h && h !== "http://" && h !== "https://");

  const bahnhof = rowText($, "huette_anreise_zug");
  const bushaltestelle = rowText($, "huette_anreise_bus");
  const pkw = rowText($, "huette_anreise_pkw");
  const parkmoeglichkeiten = rowText($, "huette_parkmoeglichkeiten");
  const approaches = parseTourEntries($, "huette_zustiege");
  const tours = parseTourEntries($, "huette_touren");

  return { edges, websites, bahnhof, bushaltestelle, pkw, parkmoeglichkeiten, approaches, tours };
}

export async function scrapeHuts({ neighbors = true, data = true } = {}) {
  const jsText = await readFile(resolve(DATA, "huettendata.js"), "utf8");
  const sandbox = { hD: {} };
  vm.createContext(sandbox);
  vm.runInContext(jsText, sandbox, { timeout: 5000 });

  const hutIds = Object.keys(sandbox.hD);
  const edges = [];
  const hutData = [];

  for (let i = 0; i < hutIds.length; i++) {
    const hutId = hutIds[i];
    const url = `https://www.alpenverein.at/huetten/index.php?huette_nr=${hutId}`;
    try {
      const res = await undiciFetch(url, { dispatcher: agent });
      const html = await res.text();
      const $ = load(html);
      const { edges: hutEdges, websites, bahnhof, bushaltestelle, pkw, parkmoeglichkeiten, approaches, tours } = scrapeHutPage(hutId, $);
      if (neighbors) edges.push(...hutEdges);
      if (data) hutData.push({ id: hutId, websites, bahnhof, bushaltestelle, pkw, parkmoeglichkeiten, approaches, tours });
    } catch (err) {
      console.error(`Skipping hut ${hutId}: ${err.message}`);
      if (data) hutData.push({ id: hutId, websites: [], bahnhof: null, bushaltestelle: null, pkw: null, parkmoeglichkeiten: null, approaches: [], tours: [] });
    }

    if (i % 50 === 0) console.log(`Scraping: ${i}/${hutIds.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  if (neighbors) {
    await writeFile(
      resolve(DATA, "graph.json"),
      JSON.stringify(edges, null, 2),
      "utf8",
    );
    console.log(`graph.json written — ${edges.length} edges`);
  }

  if (data) {
    await writeFile(
      resolve(DATA, "huts-scraped.json"),
      JSON.stringify(hutData, null, 2),
      "utf8",
    );
    console.log(`huts-scraped.json written — ${hutData.length} huts`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const neighborsOnly = args.includes("--neighbors");
  const dataOnly = args.includes("--data");
  await scrapeHuts({
    neighbors: !dataOnly,
    data: !neighborsOnly,
  });
}
