import { fetchHuts } from "./fetch-huts.mjs";
import { scrapeHuts } from "./scrape-huts.mjs";

await fetchHuts();
await scrapeHuts();
