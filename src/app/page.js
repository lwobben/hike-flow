import Image from "next/image";
import styles from "./page.module.css";
import HutsMap from "./components/HutsMap/HutsMapClient";
import TourList from "./components/TourList/TourList";
import HeroSlideshow from "./components/HeroSlideshow/HeroSlideshow";

export default function Home() {
  return (
    <div className={styles.page}>
      <HeroSlideshow>
        <div className={styles.heroOverlay}>
          <div className={styles.heroIconWrap}>
            <Image
              src="/hike-icon.jpg"
              alt="Hike icon"
              width={60}
              height={60}
              priority
              className={styles.heroIcon}
            />
          </div>
          <div>
            <h1 className={styles.heroTitle}>Welcome to the Hut2Hut app!</h1>
            <p className={styles.heroSubtitle}>Plan less. Hike more.</p>
          </div>
        </div>
      </HeroSlideshow>

      <main className={styles.main}>

        <div className={styles.intro}>
          <p>
            <strong>Experience the magic of a hut-to-hut tour in the Alps.</strong><br />Hike through
            spectacular mountain scenery, breathe in the fresh alpine air, and
            discover breathtaking views around every corner. End each day in a
            cozy mountain hut, sharing stories and local food with fellow hikers,
            before setting off on the next stage of your adventure the following
            morning.
          </p>
          <p>
            <strong>Now comes the less magical part.</strong><br />Planning a hut-to-hut tour
            hasn&apos;t caught up with modern times. You often have to jump
            between countless websites, piece together route information, and
            contact individual huts just to check availability. Since the most
            popular huts fill up months in advance, you need to start planning
            early, or risk missing out altogether.
          </p>
          <p>
            <strong>That&apos;s where Hut2Hut comes in.</strong><br />We bring everything together in
            one place, giving you a clear overview of your entire adventure.
            Explore routes on an interactive map, see hiking times between huts,
            and discover practical information. Wherever online booking is
            available, you can instantly check availability and continue to the
            hut&apos;s official booking page. Spend less time planning and more
            time looking forward to the mountains!
          </p>
        </div>

        <ol>
          <li>Choose your trail</li>
          <li>Reserve cozy huts along the way</li>
          <li>Pack your gear</li>
          <li>Hit the trail!</li>
        </ol>

        <HutsMap />
        <TourList />
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
