import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://hut2hut.app"),
  title: "Hut2Hut – Plan hut-to-hut hiking tours in the Austrian Alps",
  description:
    "Plan hut-to-hut hiking tours in the Austrian Alps. Explore routes on an interactive map, check hut availability, and book mountain huts in one place.",
  openGraph: {
    title: "Hut2Hut – Plan hut-to-hut hiking tours in the Austrian Alps",
    description:
      "Plan hut-to-hut hiking tours in the Austrian Alps. Explore routes on an interactive map, check hut availability, and book mountain huts in one place.",
    url: "https://hut2hut.app",
    siteName: "Hut2Hut",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hut2Hut – Plan hut-to-hut hiking tours in the Austrian Alps",
    description:
      "Plan hut-to-hut hiking tours in the Austrian Alps. Explore routes on an interactive map, check hut availability, and book mountain huts in one place.",
  },
  verification: {
    google: "dRk6k23zSAaI4OybS_2h7IF7IrxR8I3xxj-pfWb8VKE",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3746348551528217"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
