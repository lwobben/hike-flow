import Image from "next/image";
import styles from "./page.module.css";
import HikingRoute from "./components/HikingRoute";
import Huts from "./components/Huts";
import HutsMap from "./components/HutsMapClient";
import HutsNodes from "./components/HutsNodes";

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

        <HutsNodes />

        <HikingRoute />

        <Huts />

        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={styles.logo}
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Go to A
          </a>
          <a
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondary}
          >
            Visit B
          </a>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
