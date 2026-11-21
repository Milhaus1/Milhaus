// src/app/fonts.ts
// The site's one font: Montserrat, for everything — headings, body text,
// listings and the small uppercase labels. Terry's ask, 2026-11-21 ("change
// the whole website's font to Montserrat"). It replaces Charlie's original
// pairing from his 2026-10-08 spec — Libre Baskerville headings, Work Sans
// text, IBM Plex Mono labels — and the Dancing Script hero tagline font,
// which had been loaded but unused since that tagline became part of the
// hero photo.
//
// Loaded here once and imported by every root layout ([locale], admin,
// auth, cart, consent — each is its own <html>, so each must put the
// variable on its <html>). globals.css points --font-display, --font-body
// and --font-mono at it, so Tailwind's font-display / font-body /
// font-mono classes all render Montserrat without touching any page.

import { Montserrat } from "next/font/google";

export const montserrat = Montserrat({
  // latin covers German umlauts and ß.
  subsets: ["latin"],
  // A variable font: every weight from 100 to 900 in one file.
  style: ["normal", "italic"],
  variable: "--font-montserrat",
});
