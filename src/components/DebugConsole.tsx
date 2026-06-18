import { useEffect, useRef, useState } from 'react'

/**
 * Floating in-app debug console — for debugging on phones where F12 isn't
 * available. Captures:
 *   - window.onerror      (synchronous runtime errors)
 *   - unhandledrejection  (async / promise crashes)
 *   - console.error       (everything React reports)
 *   - console.warn        (helpful when something didn't crash but is fishy)
 *   - console.log         (best-effort tracing, off by default for noise)
 *
 * Surfaced via a tiny floating "🐞 N" badge at the bottom-right of every page.
 * Tap it to expand a fullscreen overlay with the entries.
 *
 * Disabled by default unless one of:
 *   - localStorage.debug === '1'                   (persists across sessions)
 *   - the URL contains  ?debug=1                   (single-session opt-in)
 *
 * Strip when the bug is found; this is intentionally not production telemetry.
 */
interface Entry {
  id: number
  kind: 'error' | 'warn' | 'log' | 'unhandled' | 'window'
  message: string
  stack?: string
  at: number
}

function isEnabled(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      window.localStorage.setItem('debug', '1')
      return true
    }
    return window.localStorage.getItem('debug') === '1'
  } catch {
    return false
  }
}

function stringify(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function DebugConsole() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const idRef = useRef(0)
  const enabledRef = useRef(isEnabled())

  useEffect(() => {
    if (!enabledRef.current) return

    // Persist to localStorage so entries survive a full page reload — which
    // is exactly the case we're trying to debug (page blanche after crash).
    const STORAGE_KEY = 'debug.entries'
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Entry[]
        idRef.current = parsed.reduce((m, e) => Math.max(m, e.id), 0)
        setEntries(parsed)
      }
    } catch {
      /* corrupt storage, ignore */
    }

    const push = (kind: Entry['kind'], message: string, stack?: string) => {
      setEntries((prev) => {
        const next = [...prev, { id: ++idRef.current, kind, message, stack, at: Date.now() }]
        const trimmed = next.length > 200 ? next.slice(next.length - 200) : next
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        } catch {
          /* quota / unavailable */
        }
        return trimmed
      })
    }

    // Patch console methods. Keep originals callable so the real DevTools
    // still works in parallel.
    const origError = console.error
    const origWarn = console.warn
    const origLog = console.log

    console.error = (...args: unknown[]) => {
      push('error', args.map(stringify).join(' '))
      origError.apply(console, args as any)
    }
    console.warn = (...args: unknown[]) => {
      push('warn', args.map(stringify).join(' '))
      origWarn.apply(console, args as any)
    }
    console.log = (...args: unknown[]) => {
      push('log', args.map(stringify).join(' '))
      origLog.apply(console, args as any)
    }

    const onWindowError = (event: ErrorEvent) => {
      push('window', event.message, event.error?.stack)
    }
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      push('unhandled', stringify(reason), reason?.stack)
    }
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandled)

    return () => {
      console.error = origError
      console.warn = origWarn
      console.log = origLog
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  if (!enabledRef.current) return null

  const errorCount = entries.filter((e) => e.kind === 'error' || e.kind === 'window' || e.kind === 'unhandled').length

  return (
    <>
      {/* Floating badge */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-3 right-3 z-[99999] h-12 px-3 rounded-full bg-black/80 text-white shadow-lg flex items-center gap-1.5 text-[13px] font-semibold backdrop-blur-sm"
        style={{ touchAction: 'manipulation' }}
      >
        <span>🐞</span>
        <span className={errorCount > 0 ? 'text-rose-300' : ''}>{entries.length}</span>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[99998] bg-black/90 text-white flex flex-col p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Debug console ({entries.length})</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEntries([])
                  try {
                    window.localStorage.removeItem('debug.entries')
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-3 py-1 rounded border border-white/30 text-[12px]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const text = entries
                      .map((e) => `[${e.kind}] ${e.message}${e.stack ? '\n' + e.stack : ''}`)
                      .join('\n\n')
                    navigator.clipboard?.writeText(text)
                  } catch {
                    /* clipboard refused */
                  }
                }}
                className="px-3 py-1 rounded border border-white/30 text-[12px]"
              >
                Copier
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.removeItem('debug')
                    window.localStorage.removeItem('debug.entries')
                  } catch {
                    /* ignore */
                  }
                  enabledRef.current = false
                  setOpen(false)
                }}
                className="px-3 py-1 rounded border border-white/30 text-[12px] text-amber-300"
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border border-white/30 text-[12px]"
              >
                Fermer
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-snug space-y-2">
            {entries.length === 0 && (
              <p className="text-white/50 italic">
                Aucune erreur encore. Reproduis le bug : tout sera capturé ici.
              </p>
            )}
            {entries.map((e) => {
              const color =
                e.kind === 'error' || e.kind === 'window' || e.kind === 'unhandled'
                  ? 'text-rose-300'
                  : e.kind === 'warn'
                    ? 'text-amber-300'
                    : 'text-emerald-200'
              return (
                <div key={e.id} className="border-b border-white/10 pb-2">
                  <div className={`uppercase text-[9px] font-bold ${color}`}>
                    [{e.kind}] {new Date(e.at).toLocaleTimeString('fr-FR')}
                  </div>
                  <pre className="whitespace-pre-wrap break-words mt-0.5">{e.message}</pre>
                  {e.stack && (
                    <details className="mt-1 opacity-80">
                      <summary className="text-[10px]">stack</summary>
                      <pre className="whitespace-pre-wrap break-words mt-0.5 text-[10px]">{e.stack}</pre>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
