// ═══════════════════════════════════════════════════════════════════════
// PERFORMANCE INDICATORS — which rings the athlete wants on Home.
//
// Storage is deliberately behind this seam. It writes to AsyncStorage today,
// which means the choice lives on ONE device and is lost on reinstall. The
// alternative is a column on athlete_progress, which is a change to the live
// database — so it is Keenan's call, not mine, and the whole rest of the
// feature is built so that switching is an edit to these two functions and
// nothing else.
//
// An empty list is not "no indicators", it is "decide for me" — the rail then
// falls back to its automatic order (most recently logged first). That
// distinction matters: an athlete who removes every ring wants the default
// back, not a blank strip.
// ═══════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = (userId: string) => `@bnchmrkd_indicators_${userId}`

/** The rail draws twelve at most; beyond that they're off-screen anyway. */
export const MAX_INDICATORS = 12

export async function loadIndicators(userId: string | undefined | null): Promise<string[]> {
  if (!userId) return []
  try {
    const raw = await AsyncStorage.getItem(KEY(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    // A corrupt or unreadable preference should hand back the automatic
    // order, never crash the home screen.
    return []
  }
}

export async function saveIndicators(userId: string | undefined | null, keys: string[]) {
  if (!userId) return
  try {
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(keys.slice(0, MAX_INDICATORS)))
  } catch {
    // Best-effort: the picker has already updated on screen, and losing the
    // write is better than throwing out of a save handler.
  }
}

export async function clearIndicators(userId: string | undefined | null) {
  if (!userId) return
  try { await AsyncStorage.removeItem(KEY(userId)) } catch {}
}

/**
 * Apply a chosen order to whatever the athlete has actually logged.
 *
 * Chosen keys with no data are dropped rather than drawn empty — a metric can
 * be removed from the app, or chosen on another device before it was logged
 * here. Order follows the athlete's list, not the data.
 */
export function applyIndicatorOrder<T extends { key: string }>(
  groups: T[],
  chosen: string[],
): T[] {
  if (!chosen.length) return groups
  const byKey = new Map(groups.map((g) => [g.key, g]))
  // De-duplicated on the way through. The picker cannot produce a repeat, but
  // a list written by an older build — or hand-edited storage — can, and the
  // rail keys its rings by metric: two rings with the same key is a React key
  // collision, which renders as a ring that will not update.
  const seen = new Set<string>()
  const picked: T[] = []
  for (const k of chosen) {
    if (seen.has(k)) continue
    const g = byKey.get(k)
    if (!g) continue
    seen.add(k)
    picked.push(g)
  }
  return picked.length ? picked : groups
}
