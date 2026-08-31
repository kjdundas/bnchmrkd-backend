// ═══════════════════════════════════════════════════════════════════════
// HAPTICS — physical confirmation for actions that change something.
//
// Rule of thumb: haptics confirm a COMMITTED action (a log saved, a session
// marked done, a PB hit). Never fire one on scroll, navigation, or anything
// the user does dozens of times a minute — overuse is worse than none.
// iOS only in practice; Android's implementation is coarse, hence the
// Platform guard.
// ═══════════════════════════════════════════════════════════════════════

import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

const enabled = Platform.OS === 'ios'

/** A tap landed on something meaningful — FAB, primary button. */
export function tapFeedback() {
  if (!enabled) return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

/** A state was committed — session marked done, check-in saved. */
export function successFeedback() {
  if (!enabled) return
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

/** Something went wrong the user needs to notice. */
export function errorFeedback() {
  if (!enabled) return
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}

/** A personal best — the one moment worth a heavier hit. */
export function celebrationFeedback() {
  if (!enabled) return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
}
