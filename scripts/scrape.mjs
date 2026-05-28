import { fetchHuts } from "./fetch-huts.mjs";
import { scrapeHuts } from "./scrape-huts.mjs";
import { mergeHuts } from "./merge-huts.mjs";

await fetchHuts();
await scrapeHuts();
await mergeHuts();
