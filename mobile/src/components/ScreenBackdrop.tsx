// ═══════════════════════════════════════════════════════════════════════
// SCREEN BACKDROP — the photograph IS the screen, but only at the top of it.
//
// Behind the scroll view, not inside it, so content slides over the image
// rather than dragging it along. That single detail is the difference between
// "an app with a photo in it" and Oura's Today screen.
//
// The photo is not permanent. It belongs to the first screenful — the moment
// you arrive — and it leaves as you scroll, so the data below reads on a calm
// dark ground instead of competing with a stadium for the whole session.
// Three things happen at once on the way down:
//
//   1. PARALLAX   the photo drifts up at ~0.55x the scroll, so it lags the
//                 content. Moving it 1:1 makes it feel taped to the page;
//                 holding it still makes it feel like wallpaper.
//   2. BLUR       fades in early, pulling focus off the image before it goes.
//   3. SCRIM      a wash of the ground colour deepens over the photo until it
//                 has resolved entirely into the gradient.
//
// The scrim is what dissolves the image, NOT an opacity fade on the photo
// itself. Fading the photo out would fade its darkening gradient out with it,
// so the image would get BRIGHTER on the way to disappearing. Deepening a
// scrim only ever moves toward the ground colour.
//
// Every animated property here (translateY, opacity) is native-driver safe,
// so the whole transition runs off the JS thread with the scroll.
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient as Gradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'

/** The ground everything falls into below, and behind, the image. */
export const BACKDROP_GROUND = '#0B0C18'

// The screen photographs, in one place — each with the tuning its own image
// needs. Named rather than passed as raw require() calls so a screen asks for
// a backdrop by NAME and gets the crop and treatment that were chosen for it.
//
//   position   which part of a landscape frame survives the crop into a tall
//              portrait box. The stadium wants its sky; the gym wants its
//              racks and windows, not the ceiling above them.
//   topScrim   how hard to darken the first third. The header's white text
//              and the screen title sit up there, and this is the only thing
//              standing between them and whatever the photo happens to be.
//              The gym's ceiling is near-white — 0.10 of shade would have put
//              white type on cream.
//   leftScrim  how hard to shade the LEFT EDGE, full height. topScrim is a
//              short top band and is spent by the time the screen title
//              starts — on the gym photo the title landed on a cream wall at
//              1.91:1, measured off the device. Every screen title and kicker
//              is left-aligned, so shading the left column fixes them all
//              while leaving the part of the photograph you actually look at
//              untouched. 0 disables it: the stadium's left third is dark
//              already and Home lays no hero title on bare photo.
export const BACKDROPS = {
  stadium: {
    source: require('../../assets/stadium-hero.jpg'),
    position: 'top center' as const,
    topScrim: 0.24,
    // 0.62, not 0. I set this to zero on the assumption that the stadium's
    // left side was dark and nothing laid a hero title on it. Both were
    // wrong: measured off the actual crop, the band where the greeting and
    // title sit is a warm sunlit rgb(234,207,160), which puts white type at
    // 1.70:1 and the 62%-white greeting kicker at 1.40:1 — worse than the
    // gym photo ever was. 0.62 takes them to 7.7:1 and 4.1:1.
    leftScrim: 0.62,
  },
  gym: {
    source: require('../../assets/gym-hero.jpg'),
    position: 'center' as const,
    topScrim: 0.62,
    leftScrim: 0.66,
  },
} as const

export type BackdropName = keyof typeof BACKDROPS

export default function ScreenBackdrop({
  scrollY, image = 'stadium',
}: {
  scrollY?: Animated.Value
  image?: BackdropName
}) {
  const { height } = useWindowDimensions()
  const bd = BACKDROPS[image]
  // ── Why 46% and not more ─────────────────────────────────────────
  // Both sources are 1672x941 landscape. `cover` into a PORTRAIT box scales
  // by height, so the taller the box the harder the image is blown up — and
  // the wider the crop, so you also see less of the picture. On a 393pt-wide
  // 3x screen:
  //
  //     photoH 665pt (78%)  ->  2.12x upscale   (what this was: visibly soft)
  //     photoH 470pt (55%)  ->  1.50x
  //     photoH 392pt (46%)  ->  1.25x
  //     photoH 313pt (37%)  ->  1.00x  (pixel-perfect, but a thin band)
  //
  // 46% is the trade: a 1.25x upscale is at the edge of what the eye reads as
  // sharp, and it crops 43% of the frame's width rather than 67%, so more of
  // the photograph actually survives. The cost is that the gradient has less
  // room to fall in — which is the trade Keenan called: zoom out, start the
  // gradient sooner.
  const photoH = Math.round(height * 0.46)

  // Tie the transition to the viewport rather than a fixed pixel count, so it
  // resolves at the same point in the scroll on an SE and on a Pro Max.
  const drift = scrollY
    ? scrollY.interpolate({
        inputRange: [0, height],
        outputRange: [0, -height * 0.45],
        extrapolate: 'clamp',
      })
    : 0

  // Nothing happens to the image for the first ~8% of a screen. Starting the
  // blur at scroll 0 meant the stadium was already going soft before the
  // athlete had moved — the transition has to be something you scroll INTO.
  const blurIn = scrollY
    ? scrollY.interpolate({
        inputRange: [height * 0.08, height * 0.34, height * 0.72],
        outputRange: [0, 0.25, 1],
        extrapolate: 'clamp',
      })
    : 0

  const scrimIn = scrollY
    ? scrollY.interpolate({
        inputRange: [height * 0.20, height * 0.62, height * 1.15],
        outputRange: [0, 0.45, 1],
        extrapolate: 'clamp',
      })
    : 0

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Solid ground first — the photo layer sits on top of it, so whatever
          the photo vacates is already the right colour underneath. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_GROUND }]} />

      {/* The photo and everything that acts on it travel as one group, so the
          darkening gradient can never slide out of register with the image. */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: photoH,
          transform: [{ translateY: drift }],
        }}
      >
        <ExpoImage
          source={bd.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={bd.position}
          transition={500}
          cachePolicy="memory-disk"
          accessible={false}
        />

        {scrollY && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurIn }]}>
            <BlurView intensity={52} tint="dark" style={{ flex: 1 }} />
          </Animated.View>
        )}

        {/* Nearly clear at the top so the sky keeps its warmth, fully on the
            ground by the base so content below has something solid. */}
        {/* Six stops on an accelerating curve. The old five ran 0.10 / 0.22 /
            0.62 / 0.94 — a near-linear ramp that was already at 62% black
            two-thirds of the way down, so the stands were gone before the
            gradient had anywhere left to go.
            This holds the photograph almost untouched through the top HALF
            (where the check-in card and the metric rail live), then falls
            away steeply near the base. A gradient reads as gradual when it
            spends most of its length doing very little. */}
        <Gradient
          colors={[
            'rgba(11,12,24,0.00)',
            'rgba(11,12,24,0.03)',
            'rgba(11,12,24,0.10)',
            'rgba(11,12,24,0.26)',
            'rgba(11,12,24,0.52)',
            'rgba(11,12,24,0.80)',
            'rgba(11,12,24,0.96)',
            BACKDROP_GROUND,
          ]}
          locations={[0, 0.30, 0.48, 0.64, 0.78, 0.89, 0.96, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header scrim. Legibility, not mood: it exists so the app header
            and the screen title have a floor to sit on regardless of what the
            photograph does up there. Short and steep, so it is spent well
            before the content the image is meant to be seen behind. */}
        <Gradient
          colors={[
            `rgba(11,12,24,${bd.topScrim})`,
            `rgba(11,12,24,${(bd.topScrim * 0.42).toFixed(3)})`,
            'rgba(11,12,24,0)',
          ]}
          locations={[0, 0.55, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: photoH * 0.46 }}
        />

        {/* Left-edge vignette. Horizontal, full height of the photo, so it
            has no top or bottom edge to give itself away — unlike a panel
            behind the title, which would read as a smudge. Gone by 78%
            across, which keeps the right two-thirds of the frame at full
            strength. Measured on the gym photo: title 1.91 → 6.88:1. */}
        {bd.leftScrim > 0 && (
          <Gradient
            colors={[
              `rgba(11,12,24,${bd.leftScrim})`,
              `rgba(11,12,24,${(bd.leftScrim * 0.88).toFixed(3)})`,
              `rgba(11,12,24,${(bd.leftScrim * 0.61).toFixed(3)})`,
              `rgba(11,12,24,${(bd.leftScrim * 0.18).toFixed(3)})`,
              'rgba(11,12,24,0)',
            ]}
            locations={[0, 0.30, 0.55, 0.78, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* The dissolve. Ends on the ground colour, so the photo doesn't fade
            so much as sink into the same darkness the rest of the screen is
            already made of. */}
        {scrollY && (
          <Animated.View
            style={[StyleSheet.absoluteFill, {
              backgroundColor: BACKDROP_GROUND,
              opacity: scrimIn,
            }]}
          />
        )}
      </Animated.View>
    </View>
  )
}
