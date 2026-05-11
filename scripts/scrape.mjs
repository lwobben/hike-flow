import { fetchHuts } from "./fetch-huts.mjs";
import { buildGraph } from "./scrape-neighbors.mjs";

await fetchHuts();
await buildGraph();
