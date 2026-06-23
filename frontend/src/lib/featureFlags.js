// ═══════════════════════════════════════════════════════════════════════
// FEATURE FLAGS (web)
// Single source of truth for toggling features on/off.
// ═══════════════════════════════════════════════════════════════════════

// World Athletics import (URL scrape). Paused until we have a sanctioned data
// agreement with World Athletics / a member federation. All the import code
// stays in place — flip this to true to re-enable every entry point at once.
export const WA_IMPORT_ENABLED = false
