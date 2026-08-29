import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1))
  idle(() => { import('./lib/analytics').then(({ initAnalytics }) => initAnalytics()) })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
