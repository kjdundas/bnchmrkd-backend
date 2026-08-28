// ═══════════════════════════════════════════════════════════════════════
// WORDMARK — the bnchmrkd. track-lane logo, rendered from the same SVGs
// the web app ships. Pick the variant by the surface it sits on:
//   light surface → "indigo"   dark surface → "white"
// The 'mark' variant is the square 'b' roundel (app-icon glyph).
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { SvgXml } from 'react-native-svg'
import { WORDMARK_INDIGO, WORDMARK_WHITE, BRAND_MARK } from '../assets/wordmark'

// Wordmark artwork is 826 × 167 in its viewBox → width is ~4.946 × height.
const WORDMARK_RATIO = 826 / 167

type Variant = 'indigo' | 'white' | 'mark'

interface WordmarkProps {
  /** Which artwork to draw. Defaults to the indigo wordmark. */
  variant?: Variant
  /** Rendered height in px. Width is derived from the artwork ratio. */
  height?: number
}

export default function Wordmark({ variant = 'indigo', height = 36 }: WordmarkProps) {
  if (variant === 'mark') {
    return <SvgXml xml={BRAND_MARK} width={height} height={height} />
  }
  const xml = variant === 'white' ? WORDMARK_WHITE : WORDMARK_INDIGO
  return <SvgXml xml={xml} width={height * WORDMARK_RATIO} height={height} />
}
