"use client";
import { useRef, useState } from "react";
import styles from "./TourList.module.css";

const OPPAD_BASE = "https://www.oppad.nl";
const TR = "https://translate.google.com/translate?sl=nl&tl=en&u=";
const MAIN_URL = `${TR}${OPPAD_BASE}/huttentochten-in-oostenrijk`;

const LEVEL_STYLE = {
  Beginner: "beginner",
  "Beginner–Intermediate": "beginnerIntermediate",
  Intermediate: "intermediate",
  Advanced: "advanced",
};

const TOURS = [
  {
    id: "verwall",
    title: "Verwall tour",
    description:
      "Expansive trail network through remote alpine valleys with many route variations",
    area: "Verwall, Vorarlberg / Tirol",
    start: "St. Anton am Arlberg",
    end: "Ischgl or Schruns",
    days: "5/6/8",
    heaviness: "Variable",
    level: "Intermediate–Advanced",
    url: MAIN_URL,
    paragraph: 1,
  },
  {
    id: "bischofsmutze",
    title: "Around the Bischofsmütze",
    description:
      "Compact three-day circuit around a dramatic rock spire through meadows and rock faces",
    area: "Dachstein, Northern Limestone Alps",
    start: "Filzmoos",
    end: "Filzmoos",
    days: "3",
    heaviness: "Medium",
    level: "Intermediate",
    url: `${TR}${OPPAD_BASE}/huttentocht-rondom-de-bischofsmutze`,
  },
  {
    id: "karwendel",
    title: "Karwendel tour",
    description:
      "Dramatic gorges and wild limestone peaks through one of Austria's finest hiking areas",
    area: "Karwendel, Tyrol",
    start: "Vomp",
    end: "Vomp",
    days: "5",
    heaviness: "Heavy",
    level: "Advanced",
    url: `${TR}${OPPAD_BASE}/huttentocht-karwendel`,
  },
  {
    id: "stubaier",
    title: "Stubaier Höhenweg",
    description:
      "Nine-day circuit with over 8,600 m of total elevation gain through the Stubai Alps",
    area: "Stubai Alps, Tyrol",
    start: "Neustift im Stubaital",
    end: "Neustift im Stubaital",
    days: "7",
    heaviness: "Heavy",
    level: "Advanced",
    url: `${TR}${OPPAD_BASE}/huttentocht-stubaier-hohenweg`,
  },
  {
    id: "venediger",
    title: "Venediger–Lasörling Höhenweg",
    description:
      "High-alpine traverse past 300+ three-thousanders in the Hohe Tauern National Park",
    area: "Hohe Tauern National Park",
    start: "Matreier Tauernhaus",
    end: "Virgen",
    days: "9",
    heaviness: "Very Heavy",
    level: "Advanced",
    url: `${TR}${OPPAD_BASE}/huttentocht-venediger-lasoring-hohenweg-hohe-tauern`,
  },
  {
    id: "salzburger",
    title: "Gasteinertal stages of Salzburger Almenweg",
    description:
      "Gentle route linking traditional alpine pasture huts, ideal for first-timers",
    area: "Pongau, Salzburg region",
    start: "Dorfgastein",
    end: "Sportgastein",
    days: "6",
    heaviness: "Light–Medium",
    level: "Beginner–Intermediate",
    url: `${TR}${OPPAD_BASE}/huttentocht-salzburger-almenweg`,
  },
  {
    id: "ratikon",
    title: "Rätikon tour",
    description:
      "Five-day trek through meadows, waterfalls and a small glacier across a tri-border region",
    area: "Rätikon, Austria / Switzerland / Liechtenstein",
    start: "Brand",
    end: "Latschau",
    days: "5",
    heaviness: "Medium",
    level: "Intermediate",
    url: `${TR}${OPPAD_BASE}/huttentocht-ratikon`,
  },
  {
    id: "glocknerrunde",
    title: "Glocknerrunde",
    description:
      "Demanding circuit around Austria's highest peak with big daily elevation gains",
    area: "Hohe Tauern National Park",
    start: "Bruck a.d. Glocknerstraße",
    end: "Bruck a.d. Glocknerstraße",
    days: "7",
    heaviness: "Very Heavy",
    level: "Advanced",
    url: `${TR}${OPPAD_BASE}/huttentocht-glocknerrunde-rondom-de-grossglockner`,
  },
  {
    id: "schladminger",
    title: "Schladminger Tauern",
    description:
      "High-route dotted with countless lakes and waterfalls through water-rich alpine terrain",
    area: "Niedere Tauern, Salzburg / Styria",
    start: "Schladming",
    end: "Schladming",
    days: "5",
    heaviness: "Medium",
    level: "Intermediate",
    url: `${TR}${OPPAD_BASE}/huttentocht-in-de-schladminger-tauern`,
  },
  {
    id: "peterhabeler",
    title: "Peter Habeler Runde",
    description:
      "Circuit through the western Zillertal from flower meadows and moraines to glacial terrain",
    area: "Zillertal, Tyrol",
    start: "Mayrhofen",
    end: "Mayrhofen",
    days: "6–7",
    heaviness: "Medium",
    level: "Intermediate",
    url: `${TR}${OPPAD_BASE}/huttentocht-zillertal-peter-habeler-runde`,
  },
  {
    id: "tannheimer",
    title: "Tannheimer Bergen",
    description:
      "Family-friendly ridge walk above a picturesque valley with gentle 2,000 m summits",
    area: "Tannheimer Alps, Northern Tyrol",
    start: "Tannheim",
    end: "Tannheim",
    days: "varies",
    heaviness: "Light–Medium",
    level: "Beginner–Intermediate",
    url: MAIN_URL,
    paragraph: 11,
  },
  {
    id: "adlerweg",
    title: "7-day part of Adlerweg",
    description:
      "Austria's premier long-distance route crossing the full breadth of the Tyrolean Alps",
    area: "Northern Limestone Alps, Tyrol",
    start: "St. Johann in Tirol",
    end: "St. Anton am Arlberg",
    days: "7",
    heaviness: "Heavy",
    level: "Advanced",
    url: MAIN_URL,
    paragraph: 12,
  },
];

const ExternalIcon = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline", verticalAlign: "middle" }}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function LevelBadge({ level }) {
  const key =
    Object.keys(LEVEL_STYLE).find((k) => level.startsWith(k)) ?? "Intermediate";
  return (
    <span
      className={`${styles.badge} ${styles[LEVEL_STYLE[key] ?? "intermediate"]}`}
    >
      {level}
    </span>
  );
}

function routeEndpoints(tour) {
  return tour.start === tour.end
    ? `Start & end: ${tour.start}`
    : `Start: ${tour.start} · End: ${tour.end}`;
}

function stagesLabel(days) {
  return days === "varies" ? "stages vary" : `${days} stages`;
}

function TourSourceLink({ tour }) {
  if (tour.paragraph) {
    return (
      <span className={styles.tourMeta}>
        Paragraph {tour.paragraph} of{" "}
        <a
          href={tour.url}
          target="_blank"
          rel="noopener"
          className={styles.tourMetaLink}
        >
          <ExternalIcon />
        </a>
      </span>
    );
  }

  return (
    <a
      href={tour.url}
      target="_blank"
      rel="noopener"
      className={styles.tourMetaLink}
      aria-label={`Open details for ${tour.title}`}
    >
      <ExternalIcon />
    </a>
  );
}

const TOOLTIP_TEXT = (
  <>
    The number of stages provides a guideline for the length of your trip, but
    it is not fixed. Strong hikers may combine two stages into one longer day,
    while others prefer to split a stage over two days when an intermediate hut
    is available. You can shorten a route by joining or leaving at any point
    along the way, or extend your adventure by continuing to additional huts
    beyond the listed endpoint.
    <br />
    <br />
    Think of these itineraries as a starting point, not a fixed plan. Every
    hiker creates their own unique journey, shaped by their pace, preferences,
    and sense of adventure.
  </>
);

function DaysHeader() {
  const iconRef = useRef(null);
  const [tipPos, setTipPos] = useState(null);

  const show = () => {
    const r = iconRef.current.getBoundingClientRect();
    setTipPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  };

  return (
    <span className={styles.daysHeader}>
      Stages
      <span
        ref={iconRef}
        className={styles.infoIcon}
        onMouseEnter={show}
        onMouseLeave={() => setTipPos(null)}
      >
        i
      </span>
      {tipPos && (
        <span
          className={styles.tooltip}
          style={{ top: tipPos.top, left: tipPos.left }}
        >
          {TOOLTIP_TEXT}
        </span>
      )}
    </span>
  );
}

export default function TourList() {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Some examples</p>
          <h2 className={styles.title}>Beautiful hut-to-hut hikes in Austria</h2>
        </div>
        <a
          href={MAIN_URL}
          target="_blank"
          rel="noopener"
          className={styles.sourceLink}
          title="Source: oppad.nl"
        >
          <ExternalIcon size={16} />
        </a>
      </div>

      <ol className={styles.mobileList}>
        {TOURS.map((tour, index) => (
          <li key={tour.id} className={styles.mobileItem} data-tour-id={tour.id}>
            <div className={styles.mobileTitleRow}>
              <span className={styles.mobileIndex}>{index + 1}.</span>
              <span className={styles.mobileTitle}>{tour.title}</span>
              <TourSourceLink tour={tour} />
            </div>
            <p className={styles.mobileSubline}>
              {tour.area} · {stagesLabel(tour.days)}
            </p>
            <p className={styles.mobileDescription}>{tour.description}</p>
            <p className={styles.mobileMeta}>
              {routeEndpoints(tour)} · Effort: {tour.heaviness} · Level:{" "}
              {tour.level}
            </p>
          </li>
        ))}
      </ol>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tour</th>
              <th>Description</th>
              <th>
                <DaysHeader />
              </th>
              <th>Area</th>
              <th>Start</th>
              <th>End</th>
              <th>Effort</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {TOURS.map((tour) => (
              <tr key={tour.id} data-tour-id={tour.id}>
                <td className={styles.tourName}>
                  <div>{tour.title}</div>
                  <TourSourceLink tour={tour} />
                </td>
                <td className={styles.description}>{tour.description}</td>
                <td className={styles.days}>{tour.days}</td>
                <td>{tour.area}</td>
                <td>{tour.start}</td>
                <td>{tour.end}</td>
                <td>{tour.heaviness}</td>
                <td>
                  <LevelBadge level={tour.level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
