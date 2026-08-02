/**
 * Classic hut-to-hut tours shown in TourList, mapped to Alpenverein hut IDs.
 *
 * officialHutIds = overnight / core stage huts on the longest classic itinerary
 * optionalHutIds = kept for reference (lunch stops, splits, variants) — not shown on map
 * places = common access towns shown on the map when the tour is focused
 */

function place(name, lat, lon) {
  return { name, lat, lon };
}

export const MAP_TOURS = [
  {
    id: "verwall",
    title: "Verwall tour",
    // Official 8-day Verwall-Runde (verwall.de)
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
      "0677", // Neue Reutlinger Hütte
      "0656", // Wormser Hütte
      "0571", // Jamtalhütte
    ],
    places: [
      place("St. Christoph", 47.12764, 10.2136),
      place("Pettneu", 47.14818, 10.34135),
      place("St. Anton", 47.1289, 10.26637),
    ],
  },
  {
    id: "bischofsmutze",
    title: "Around the Bischofsmütze",
    officialHutIds: [
      "0108", // Hofpürgl-Hütte
      "0070", // Gablonzer Hütte
    ],
    optionalHutIds: [],
    places: [place("Filzmoos", 47.43299, 13.51821)],
  },
  {
    id: "karwendel",
    title: "Karwendel tour",
    // Classic Karwendel crossing (Vomp / Pertisau side), not the western Höhenweg
    officialHutIds: [
      "0586", // Lamsenjochhütte
      "0534", // Falkenhütte
      "0578", // Karwendelhaus
      "0556", // Hallerangerhaus
    ],
    optionalHutIds: [
      "1792", // Hallerangeralm
      "1664", // Lalidererspitzen-Biwak
    ],
    places: [
      place("Pertisau", 47.44007, 11.69901),
      place("Eng", 47.40241, 11.56788),
      place("Scharnitz", 47.39027, 11.2648),
      place("Vomp", 47.34227, 11.68327),
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
    optionalHutIds: [],
    places: [
      place("Neustift", 47.11064, 11.30758),
      place("Fulpmes", 47.1531, 11.34906),
    ],
  },
  {
    id: "venediger",
    title: "Venediger–Lasörling Höhenweg",
    // Longest combined Venediger + Lasörling traverse
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
      "1275", // Eisseehütte
      "1281", // Lasnitzenhütte
      "1286", // Wetterkreuzhütte
    ],
    places: [
      place("Matreier Tauernhaus", 47.11905, 12.49653),
      place("Prägraten", 47.03804, 12.31244),
      place("Virgen", 47.00389, 12.46004),
      place("Matrei", 47.00106, 12.53875),
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
      "0096", // Heinrich-Hueter-Hütte
      "1335", // Schesaplanahütte
      "1334", // Pfälzerhütte
    ],
    places: [
      place("Brand", 47.10424, 9.73788),
      place("Latschau", 47.07788, 9.87512),
    ],
  },
  {
    id: "glocknerrunde",
    title: "Glocknerrunde",
    // Longest classic AV 7-day circuit (Alpenverein brochure).
    // Rudolfshütte / town nights (Kals, Heiligenblut, Fusch) are not in the AV hut dataset.
    officialHutIds: [
      "0574", // Kalser Tauernhaus (split overnight on long stage 2)
      "0641", // Sudetendeutsche Hütte
      "0550", // Glorer Hütte
      "0198", // Salm-Hütte
      "0076", // Glockner-Haus
      "0549", // Gleiwitzer Hütte
    ],
    optionalHutIds: [
      "1297", // Lucknerhütte
      "1296", // Lucknerhaus (Neues)
      "0640", // Stüdlhütte
      "0164", // Oberwalder-Hütte
      "0583", // Krefelder Hütte
      "1293", // Erzherzog-Johann-Hütte
      "0075", // Glockner-Biwak
      "0085", // Gruberscharten-Biwak
    ],
    places: [
      place("Kaprun", 47.27139, 12.75737),
      place("Kals", 47.00238, 12.64585),
      place("Heiligenblut", 47.03854, 12.84082),
      place("Fusch", 47.22565, 12.82562),
    ],
  },
  {
    id: "schladminger",
    title: "Schladminger Tauern",
    // Longest classic high-trail overnight AV huts (Landawirsee on the long stage 3)
    officialHutIds: [
      "0112", // Ignaz-Mattis-Hütte
      "0125", // Keinprecht-Hütte
      "0135", // Landawirsee-Hütte
      "1320", // Gollinghütte
      "1321", // Preintalerhütte
    ],
    optionalHutIds: [
      "0195", // Rudolf-Schober-Hütte (eastward extension)
      "0203", // Schladminger Hütte (Planai end variant)
    ],
    places: [
      place("Schladming", 47.39404, 13.68679),
      place("Rohrmoos", 47.38272, 13.6685),
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
      "1312", // Berggasthaus Breitlahner
    ],
    places: [
      place("Ginzling", 47.10032, 11.80904),
      place("Schlegeis", 47.02422, 11.70949),
      place("Hintertux", 47.11502, 11.6825),
      place("Mayrhofen", 47.16954, 11.86273),
    ],
  },
  {
    id: "tannheimer",
    title: "Tannheimer Bergen",
    // No single fixed stage list — main overnight hubs commonly combined in the valley
    officialHutIds: [
      "1463", // Gimpelhaus
      "0658", // Tannheimer Hütte
      "0614", // Otto-Mayr-Hütte
      "0659", // Willi-Merkl-Gedächtnis-Hütte
      "0617", // Bad Kissinger Hütte
      // Landsberger Hütte omitted — no AV walking-time edges to the ridge hubs above
    ],
    optionalHutIds: [],
    places: [
      place("Tannheim", 47.499417, 10.516099),
      place("Nesselwängle", 47.48502, 10.61094),
      place("Grän", 47.50101, 10.55346),
    ],
  },
];

export const MAP_TOURS_BY_ID = Object.fromEntries(
  MAP_TOURS.map((t) => [t.id, t]),
);
