import React from 'react'

/**
 * Top-level React error boundary.
 *
 * Catches any uncaught render/lifecycle errors in the tree below it and
 * renders a branded fallback UI instead of a white screen. This protects
 * the app during launch from the single most embarrassing failure mode:
 * one discipline's analyzer path throws → entire app white-screens in
 * front of a user.
 *
 * In development: also dumps the error + stack to the console so we can
 * see what broke. In production: shows a friendly "something went wrong"
 * card with a Reload button and (optionally) a tech-details disclosure.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // Always log to console so we can debug from a screenshot / user report.
    // eslint-disable-next-line no-console
    console.error('[bnchmrkd.] ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    // Hard reload — clears any wedged in-memory state.
    window.location.reload()
  }

  handleGoHome = () => {
    // Soft reset: navigate to root and clear any deep-link params.
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo } = this.state
    const isDev = import.meta.env.DEV

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        <div
          className="max-w-lg w-full rounded-2xl p-6 sm:p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="mb-5">
            <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-orange-400/80 mb-1.5">
              Unexpected error
            </p>
            <h1 className="landing-font text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              bnchmrkd. hit an error it couldn&rsquo;t recover from. Your data is safe &mdash;
              nothing was saved or sent. Reload to start fresh, or head back home.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <button
              onClick={this.handleReload}
              className="flex-1 landing-font text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors focus:outline-none focus-visible:outline-none"
              style={{
                background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
                color: '#0f172a',
              }}
            >
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex-1 landing-font text-sm font-medium py-2.5 px-4 rounded-xl transition-colors focus:outline-none focus-visible:outline-none text-slate-300 hover:text-white"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Go home
            </button>
          </div>

          {/* Technical details — always visible in dev, disclosure in prod */}
          {(isDev || error) && (
            <details className="mt-3" open={isDev}>
              <summary className="mono-font text-[10px] uppercase tracking-[0.15em] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                Technical details
              </summary>
              <div className="mt-3 p-3 rounded-lg overflow-auto max-h-64"
                   style={{background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <p className="mono-font text-[11px] text-orange-300 mb-2 break-all">
                  {error && (error.message || String(error))}
                </p>
                {isDev && error && error.stack && (
                  <pre className="mono-font text-[10px] text-slate-500 whitespace-pre-wrap break-all">
                    {error.stack}
                  </pre>
                )}
                {isDev && errorInfo && errorInfo.componentStack && (
                  <pre className="mono-font text-[10px] text-slate-600 whitespace-pre-wrap break-all mt-2 pt-2 border-t border-white/5">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <p className="mt-5 text-[11px] text-slate-600 text-center landing-font">
            If this keeps happening, take a screenshot of the technical details and let us know.
          </p>
        </div>
      </div>
    )
  }
}
