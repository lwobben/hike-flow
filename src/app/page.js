import Image from "next/image";
import styles from "./page.module.css";
import Huts from "./components/Huts";
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

        <h2>Welcome to HikeFlow!</h2>

        <p>Discover stunning mountain routes and plan your next adventure.</p>

        <ol>
          <li>Choose your trail</li>
          <li>Reserve cozy huts along the way</li>
          <li>Pack your gear</li>
          <li>Hit the trail!</li>
        </ol>

        <HutsMap />

        <Huts />
      </main>
    </div>
  );
}
