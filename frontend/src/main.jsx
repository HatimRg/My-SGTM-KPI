import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import toast, { Toaster, ToastBar } from 'react-hot-toast'
import { LanguageProvider } from './i18n'
import App from './App.jsx'
import './index.css'

const safeToString = (value) => {
  try {
    if (value instanceof Error) return value.stack || value.message || String(value)
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unserializable]'
    }
  }
}

const logGlobalError = (type, payload) => {
  try {
    const href = typeof window !== 'undefined' ? window.location?.href : ''
    const ts = new Date().toISOString()
    const summary = payload?.message || payload?.reason?.message || payload?.error?.message || payload?.error?.toString?.() || payload?.reason?.toString?.() || 'Unknown error'
    console.groupCollapsed(`[APP:${type}] ${summary}`)
    console.log('time', ts)
    console.log('url', href)
    console.log('userAgent', typeof navigator !== 'undefined' ? navigator.userAgent : '')
    if (payload?.error) console.error(payload.error)
    if (payload?.reason) console.error(payload.reason)
    if (payload?.source || payload?.lineno || payload?.colno) {
      console.log('source', payload.source)
      console.log('line', payload.lineno)
      console.log('col', payload.colno)
    }
    if (payload?.promise) console.log('promise', payload.promise)
    if (payload && !payload.error && !payload.reason) console.log('payload', payload)
    console.groupEnd()
  } catch (e) {
    console.error('[APP] Failed to log global error', e, safeToString(payload))
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logGlobalError('window.error', {
      message: event?.message,
      error: event?.error,
      source: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    logGlobalError('unhandledrejection', {
      reason: event?.reason,
      promise: event?.promise,
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
        <App />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#fff',
          },
          success: {
            duration: 2500,
            iconTheme: {
              primary: '#16a34a',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fff',
            },
          },
        }}
      >
        {(t) => (
          <div
            onClick={() => toast.dismiss(t.id)}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <ToastBar toast={t} />
          </div>
        )}
      </Toaster>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
