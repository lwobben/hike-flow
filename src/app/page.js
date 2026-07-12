import Image from "next/image";
import styles from "./page.module.css";
import HutsMap from "./components/HutsMap/HutsMapClient";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/hike-icon.jpg"
          alt="Hike icon"
          width={150}
          height={150}
          priority
        />

        <h2>Welcome to the Hut2Hut app!</h2>

        <p>Discover stunning mountain routes and plan your next adventure.</p>

        <ol>
          <li>Choose your trail</li>
          <li>Reserve cozy huts along the way</li>
          <li>Pack your gear</li>
          <li>Hit the trail!</li>
        </ol>

        <HutsMap />
      </main>

      <section className={styles.disclaimers}>
        <p>
          <strong>Early access:</strong> Hut2Hut is continuously evolving. At
          the moment only huts from the Austrian Alpenverein are available as
          a source. More countries and regions are on the way.
        </p>
        <p>
          <strong>Safety:</strong> Mountain hiking carries real risks. Always
          check weather conditions, carry appropriate gear, and know your
          limits. We are not responsible for any incidents, injuries, or
          losses that may occur. If you are inexperienced, consider hiring a
          certified mountain guide before heading out.
        </p>
        <p>
          <strong>Hiking times:</strong> The durations shown are sourced from
          the Alpenverein neighbouring huts pages and are reference values
          only. Your actual time may be shorter or longer depending on
          fitness, pack weight, and conditions. There may also be multiple
          routes between two huts with different difficulties and durations.
        </p>
      </section>
    </div>
  );
}
