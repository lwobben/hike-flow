# hike-flow

Live at [hut2hut.app](https://hut2hut.app).

A Next.js app for planning hut-to-hut hiking tours in the Alps. Browse huts on a map, pick a date range, check real-time availability, and plan multi-day routes between neighboring huts.

Data comes from the Alpenverein (Austrian Alpine Club) — hut locations, walking times between neighbors, and live bed availability all pulled from their site.

## What it does

- Interactive map of Alpine huts (MapLibre GL)
- Click any hut to see its details, neighbors, and walking times to the next hut
- Date range picker to filter availability
- Availability check against the Alpenverein booking system
- Tour planning modal to chain huts into a multi-day itinerary

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    api/
      huts/          # serves hut data from data/huts-combined.json
      availability/  # proxies availability requests to Alpenverein
    components/
      HutsMap/       # map, hut popups, date picker, tour planning modal
    page.js
    layout.js
  components/ui/     # shared UI primitives (shadcn)
  lib/utils.js

data/                # static JSON built by the scrape scripts
scripts/             # data pipeline (fetch, scrape, merge)
```

The app reads from `data/huts-combined.json` at runtime. That file is built by the scrape scripts and committed to the repo, so you don't need to run the scripts to use the app. Re-run them when you want to refresh hut data.

See [scripts/README.md](scripts/README.md) for details on the data pipeline.
