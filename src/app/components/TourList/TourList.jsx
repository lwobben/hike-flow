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

/** Mountain groups from MAP_TOURS hut gebirgsgruppe + bundesland. */
const TOURS = [
  {
    id: "verwall",
    title: "Verwall tour",
    description:
      "Expansive trail network through remote alpine valleys with many route variations",
    mountainGroups: ["Verwallgruppe (Tirol / Vorarlberg)"],
    accessPoints: ["St. Christoph", "Pettneu", "St. Anton"],
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
    mountainGroups: ["Dachsteingebirge (Oberösterreich / Salzburg)"],
    accessPoints: ["Filzmoos"],
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
    mountainGroups: ["Karwendel (Tirol)"],
    accessPoints: ["Pertisau", "Eng", "Scharnitz", "Vomp"],
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
    mountainGroups: ["Stubaier Alpen (Tirol)"],
    accessPoints: ["Neustift", "Fulpmes"],
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
    mountainGroups: [
      "Venedigergruppe (Salzburg / Tirol)",
      "Lasörlinggruppe (Tirol)",
    ],
    accessPoints: ["Matreier Tauernhaus", "Prägraten", "Virgen", "Matrei"],
    days: "9",
    heaviness: "Very Heavy",
    level: "Advanced",
    url: `${TR}${OPPAD_BASE}/huttentocht-venediger-lasoring-hohenweg-hohe-tauern`,
  },
  {
    id: "ratikon",
    title: "Rätikon tour",
    description:
      "Five-day trek through meadows, waterfalls and a small glacier across a tri-border region",
    mountainGroups: ["Rätikon (Vorarlberg / Schweiz / Liechtenstein)"],
    accessPoints: ["Brand", "Latschau"],
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
    mountainGroups: [
      "Glocknergruppe (Kärnten / Salzburg / Tirol)",
      "Granatspitzgruppe (Tirol)",
    ],
    accessPoints: ["Kaprun", "Kals", "Heiligenblut", "Fusch"],
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
    mountainGroups: ["Schladminger Tauern (Salzburg / Steiermark)"],
    accessPoints: ["Schladming", "Rohrmoos"],
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
    mountainGroups: [
      "Zillertaler Alpen (Tirol / Italien/Südtirol)",
      "Tuxer Alpen (Tirol)",
    ],
    accessPoints: ["Ginzling", "Schlegeis", "Hintertux", "Mayrhofen"],
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
    mountainGroups: ["Allgäuer Alpen (Tirol)"],
    accessPoints: ["Tannheim", "Nesselwängle", "Grän"],
    days: "varies",
    heaviness: "Light–Medium",
    level: "Beginner–Intermediate",
    url: MAIN_URL,
    paragraph: 11,
  },
];

function BulletList({ items, className }) {
  if (items.length === 1) {
    return <div className={className}>{items[0]}</div>;
  }
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
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

function ViewOnMapButton({ tour, focused, onViewOnMap }) {
  return (
    <button
      type="button"
      className={focused ? styles.viewOnMapActive : styles.viewOnMap}
      onClick={() => onViewOnMap?.(tour.id)}
    >
      {focused ? "Hide from map" : "View in map above"}
    </button>
  );
}

export default function TourList({ focusedTourId = null, onViewOnMap }) {
  return (
    <section id="tour-examples" className={styles.section}>
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
            <ViewOnMapButton
              tour={tour}
              focused={focusedTourId === tour.id}
              onViewOnMap={onViewOnMap}
            />
            {tour.mountainGroups.length === 1 ? (
              <p className={styles.mobileSubline}>
                {tour.mountainGroups[0]} · {stagesLabel(tour.days)}
              </p>
            ) : (
              <div className={styles.mobileSubline}>
                <BulletList
                  items={tour.mountainGroups}
                  className={styles.mobileMountainGroups}
                />
                <span>{stagesLabel(tour.days)}</span>
              </div>
            )}
            <p className={styles.mobileDescription}>{tour.description}</p>
            <p className={styles.mobileMeta}>
              Access: {tour.accessPoints.join(", ")} · Effort: {tour.heaviness}{" "}
              · Level: {tour.level}
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
              <th>Mountain group</th>
              <th>Most common start &amp; end points</th>
              <th>Effort</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {TOURS.map((tour) => (
              <tr key={tour.id} data-tour-id={tour.id}>
                <td className={styles.tourName}>
                  <div>{tour.title}</div>
                  <div className={styles.tourActions}>
                    <ViewOnMapButton
                      tour={tour}
                      focused={focusedTourId === tour.id}
                      onViewOnMap={onViewOnMap}
                    />
                    <TourSourceLink tour={tour} />
                  </div>
                </td>
                <td className={styles.description}>{tour.description}</td>
                <td className={styles.days}>{tour.days}</td>
                <td>
                  <BulletList
                    items={tour.mountainGroups}
                    className={styles.mountainGroups}
                  />
                </td>
                <td>
                  <BulletList
                    items={tour.accessPoints}
                    className={styles.accessPoints}
                  />
                </td>
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
