// ═══════════════════════════════════════════════════════════════════════
// WHERE THE BACKEND LIVES.
//
// This was hardcoded to the Railway URL in three separate screens, which
// meant testing a backend change required editing three files and remembering
// to revert all three — so in practice it meant pushing to production to find
// out whether something worked.
//
// Set EXPO_PUBLIC_API_BASE in mobile/.env to point at a machine on your
// network instead:
//
//     EXPO_PUBLIC_API_BASE=http://192.168.1.42:8000
//
// Two things about that address. It must be your machine's LAN IP, not
// localhost — localhost on a phone is the phone. And the backend must be
// started with --host 0.0.0.0, or it only listens on the loopback interface
// and nothing outside the machine can reach it.
//
// Expo inlines EXPO_PUBLIC_* at bundle time, so the dev server needs a
// restart after changing it. Delete the line to go back to production.
// ═══════════════════════════════════════════════════════════════════════

const PRODUCTION = 'https://web-production-295f1.up.railway.app'

export const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '') || PRODUCTION

/** True when the app is NOT talking to production — worth showing on screen. */
export const IS_LOCAL_API = API_BASE !== PRODUCTION
