/**
 * Every image the Saloon UI uses, resolved through Vite so only what is
 * imported here ships in the build (hashed, cacheable).
 */
import type { Card } from "../engine";
import type { Portrait } from "../app/state";
import type { Mood } from "../app/reveal";

import cipherCandle from "../../assets/art/cipher_candle.webp";
import cipherSmug from "../../assets/art/cipher_smug.webp";
import cipherCaught from "../../assets/art/cipher_caught.webp";
import vegaCandle from "../../assets/art/vega_candle.webp";
import vegaSmug from "../../assets/art/vega_smug.webp";
import vegaCaught from "../../assets/art/vega_caught.webp";
import onyxCandle from "../../assets/art/onyx_candle.webp";
import onyxSmug from "../../assets/art/onyx_smug.webp";
import onyxCaught from "../../assets/art/onyx_caught.webp";
import titleArt from "../../assets/art/title.webp";
import wallArt from "../../assets/art/wall.webp";
import cardBack from "../../assets/art/cardback.webp";
import candlestick from "../../assets/props/candlestick.webp";
import railTexture from "../../assets/textures/rail.webp";

/**
 * Portrait x mood -> image. The seated, neutral pose is the candlelit art;
 * smug/caught are the painted reaction shots until candlelit versions land
 * (swap a file name here and nothing else changes).
 */
export const PORTRAIT_ART: Record<Portrait, Record<Mood, string>> = {
  cipher: { neutral: cipherCandle, smug: cipherSmug, caught: cipherCaught },
  vega: { neutral: vegaCandle, smug: vegaSmug, caught: vegaCaught },
  onyx: { neutral: onyxCandle, smug: onyxSmug, caught: onyxCaught },
};

export const ART = { title: titleArt, wall: wallArt, cardBack, candlestick, rail: railTexture } as const;

/** Fomin "English pattern" faces (CC0), keyed by file stem, e.g. "7_of_spades". */
const FACES = import.meta.glob<string>("../../assets/cards/*.webp", { eager: true, query: "?url", import: "default" });

const RANK_FILE: Record<number, string> = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
const SUIT_FILE = { c: "clubs", d: "diamonds", h: "hearts", s: "spades" } as const;

/** Image URL for a card face, or null for jokers (drawn in CSS). */
export function faceUrl(card: Card): string | null {
  if (card.kind === "joker") return null;
  const rank = card.kind === "two" ? "2" : (RANK_FILE[card.rank] ?? String(card.rank));
  return FACES[`../../assets/cards/${rank}_of_${SUIT_FILE[card.suit]}.webp`] ?? null;
}

/** Warm the cache for the reaction art so the reveal swap never flashes empty. */
export function preloadArt(): void {
  for (const moods of Object.values(PORTRAIT_ART)) {
    for (const url of Object.values(moods)) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  }
}
