// PostHog analytics wrapper — cookieless, EU region.
// No-ops gracefully if VITE_POSTHOG_KEY is missing (e.g. local dev without .env).
import posthog from 'posthog-js'

let initialized = false

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'
  if (!key || initialized) return
  try {
    posthog.init(key, {
      api_host: host,
      persistence: 'memory',        // cookieless — no GDPR banner needed
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug(false)
      },
    })
    initialized = true
  } catch (err) {
    console.warn('[analytics] init failed', err)
  }
}

export function track(event, props = {}) {
  if (!initialized) return
  try {
    posthog.capture(event, props)
  } catch (err) {
    // swallow — analytics must never break the app
  }
}

// Named helpers for type-safety across the codebase
export const analytics = {
  signupCompleted: (props = {}) => track('signup_completed', props),
  analyzerRun: (props) => track('analyzer_run', props),             // { discipline, gender, mode }
  disciplineSelected: (props) => track('discipline_selected', props), // { discipline }
  metricLogged: (props) => track('metric_logged', props),           // { metric }
  standardsTabViewed: (props = {}) => track('standards_tab_viewed', props),
  infoPopoverOpened: (props) => track('info_popover_opened', props), // { axis }
}
