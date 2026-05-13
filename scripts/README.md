# Scripts

Data-fetching scripts that populate the static files the app reads at runtime.

## Overview

| Script                 | Output           | Description                                         |
| ---------------------- | ---------------- | --------------------------------------------------- |
| `fetch-huts.mjs`       | `huettendata.js` | Fetches the full hut list from the Alpenverein API  |
| `scrape-neighbors.mjs` | `graph.json`     | Scrapes each hut's neighbor links and walking times |
| `scrape.mjs`           | both             | Runs both scripts in sequence (recommended)         |

Both output files are written to the project root.

## Usage

### Run everything (recommended)

```bash
npm run scrape
```

### Run steps individually

```bash
# Fetch hut list only
node scripts/fetch-huts.mjs

# Scrape neighbor graph only (requires huettendata.js to exist)
node scripts/scrape-neighbors.mjs
```

## Notes

- `scrape-neighbors.mjs` makes one HTTP request per hut with a 150 ms delay between requests — expect it to take a while on a full run.
- `graph.json` is written in one shot after all huts have been scraped, so the app never reads a half-finished file.
- Both scripts can be run independently, so you can refresh just the hut list without re-scraping the graph (or vice versa).
