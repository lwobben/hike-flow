"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./HeroSlideshow.module.css";

const IMAGES = [
  { src: "/view2.jpeg", alt: "Alpine view" },
  { src: "/view3.jpeg", alt: "Alpine view 2" },
];

export default function HeroSlideshow({ children }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((i) => (i + 1) % IMAGES.length);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.wrap}>
      {IMAGES.map((img, i) => (
        <Image
          key={img.src}
          src={img.src}
          alt={img.alt}
          fill
          className={`${styles.slide} ${i === current ? styles.active : ""}`}
          priority={i === 0}
        />
      ))}
      {children}
    </div>
  );
}
