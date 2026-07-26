/**
 * Classic hut-to-hut tours shown in TourList, mapped to Alpenverein hut IDs.
 *
 * official = planned overnight / core stage huts on the classic route
 * optional = nearby huts for custom itineraries: lunch stops, day-splits,
 *            full-hut swaps, short detours — not wholly different tours
 */
export const MAP_TOURS = [
  {
    id: "verwall",
    title: "Verwall tour",
    officialHutIds: [
      "0575", // Kaltenberghütte
      "0582", // Konstanzer Hütte
      "0560", // Neue Heilbronner Hütte
      "0537", // Friedrichshafener Hütte
      "0524", // Darmstädter Hütte
      "0605", // Niederelbehütte
      "0048", // Edmund-Graf-Hütte
    ],
    optionalHutIds: [
      "0676", // Kieler Wetterhütte (high variant Darmstädter↔Niederelbe)
      "0677", // Neue Reutlinger Hütte (self-catering; insert near Konstanzer/Heilbronner)
      "0656", // Wormser Hütte (Wormser Höhenweg variant)
      "0571", // Jamtalhütte (Paznaun-side extension)
    ],
  },
  {
    id: "bischofsmutze",
    title: "Around the Bischofsmütze",
    officialHutIds: [
      "0108", // Hofpürgl-Hütte
      "0070", // Gablonzer Hütte
    ],
    // Stuhlalm / Sulzenalm / Aualm are common lunch or overnight inserts,
    // but they are private alms and not in the AV hut dataset.
    optionalHutIds: [],
  },
  {
    id: "karwendel",
    title: "Karwendel tour",
    officialHutIds: [
      "0586", // Lamsenjochhütte
      "0534", // Falkenhütte
      "0578", // Karwendelhaus
      "0556", // Hallerangerhaus
    ],
    optionalHutIds: [
      "1792", // Hallerangeralm (beside Hallerangerhaus)
      "1664", // Lalidererspitzen-Biwak (near Falkenhütte / Laliderer walls)
    ],
  },
  {
    id: "stubaier",
    title: "Stubaier Höhenweg",
    officialHutIds: [
      "0637", // Starkenburger Hütte
      "0065", // Franz-Senn-Hütte
      "0625", // Regensburger Hütte (Neue)
      "0527", // Dresdner Hütte
      "0642", // Sulzenauhütte
      "0608", // Nürnberger Hütte
      "0519", // Bremer Hütte
      "0113", // Innsbrucker Hütte
    ],
    // Stages already hop hut-to-hut; no separate mid-route AV lunch huts.
    optionalHutIds: [],
  },
  {
    id: "venediger",
    title: "Venediger–Lasörling Höhenweg",
    officialHutIds: [
      "0215", // St. Pöltner Hütte
      "0620", // Neue Prager Hütte
      "0018", // Badener Hütte
      "0025", // Bonn-Matreier Hütte
      "0572", // Johannishütte
      "0533", // Essener und Rostocker Hütte
      "0183", // Neue Reichenberger Hütte
      "1216", // Lasörlinghütte
      "1287", // Zupalseehütte
    ],
    optionalHutIds: [
      "1275", // Eisseehütte (mid day 5 Bonn-Matreier → Johannis)
      "1281", // Lasnitzenhütte (near day 8 Lasörling approach)
      "1286", // Wetterkreuzhütte (last-day alternative / taxi link)
    ],
  },
  {
    id: "ratikon",
    title: "Rätikon tour",
    officialHutIds: [
      "0610", // Oberzalimhütte
      "0600", // Mannheimer Hütte
      "0229", // Totalp-Hütte
      "0593", // Lindauer Hütte
    ],
    optionalHutIds: [
      "0096", // Heinrich-Hueter-Hütte (near Lünersee; common insert/swap)
      "1335", // Schesaplanahütte (CH extension)
      "1334", // Pfälzerhütte (LI border extension)
      // Douglasshütte (Lünersee lunch) is not in the AV hut dataset
    ],
  },
  {
    id: "glocknerrunde",
    title: "Glocknerrunde",
    officialHutIds: [
      "0641", // Sudetendeutsche Hütte
      "0198", // Salm-Hütte
      "0076", // Glockner-Haus
    ],
    optionalHutIds: [
      "0574", // Kalser Tauernhaus (on day 4 via Kalser Tauern)
      "1297", // Lucknerhütte (Kals / Peischlach approach)
      "1296", // Lucknerhaus (Neues) (valley approach from Kals)
      "0550", // Glorer Hütte (variant toward Salm from Kals)
      "0640", // Stüdlhütte (common Kals–Glockner variant)
      "0164", // Oberwalder-Hütte (near Pasterze / Glocknerhaus side)
      "0583", // Krefelder Hütte (Kaprun / Mooserboden side)
      "1293", // Erzherzog-Johann-Hütte (Adlersruhe — Glockner ascent)
      "0075", // Glockner-Biwak
      "0085", // Gruberscharten-Biwak
    ],
  },
  {
    id: "schladminger",
    title: "Schladminger Tauern",
    officialHutIds: [
      "0112", // Ignaz-Mattis-Hütte
      "0125", // Keinprecht-Hütte
      "0135", // Landawirsee-Hütte
      "1320", // Gollinghütte
      "1321", // Preintalerhütte
    ],
    optionalHutIds: [
      // Duisitzkarseehütte / Fahrlechhütte are the classic day-2 lunch
      // (and optional overnight) stops, but they are private and not in AV data.
      "0195", // Rudolf-Schober-Hütte (eastward extension)
    ],
  },
  {
    id: "peterhabeler",
    title: "Peter Habeler Runde",
    officialHutIds: [
      "0547", // Geraer Hütte
      "1252", // Tuxer-Joch-Haus
      "0538", // Friesenberghaus
      "0611", // Olpererhütte
      "1254", // Pfitscher-Joch-Haus
      "0588", // Landshuter-Europa-Hütte
    ],
    optionalHutIds: [
      "1312", // Berggasthaus Breitlahner (valley start/end insert)
      // Spannagelhaus / Tuxer Fernerhaus (mid Tuxerjoch↔Friesenberg) not in AV data
    ],
  },
  {
    id: "tannheimer",
    title: "Tannheimer Bergen",
    officialHutIds: [
      "1463", // Gimpelhaus
      "0658", // Tannheimer Hütte
      "0614", // Otto-Mayr-Hütte
      "0587", // Landsberger Hütte
    ],
    optionalHutIds: [
      "0659", // Willi-Merkl-Gedächtnis-Hütte (beside Otto-Mayr)
      "0617", // Bad Kissinger Hütte (nearby Allgäu link)
      // Füssener Hütte / Krinnenalpe / Schneetalalm etc. are private alms
    ],
  },
];

export const MAP_TOURS_BY_ID = Object.fromEntries(
  MAP_TOURS.map((t) => [t.id, t]),
);
