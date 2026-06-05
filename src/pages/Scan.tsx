import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X, Loader2, Camera } from 'lucide-react'

/**
 * Mobile-first scanner page.
 *
 * Workflow:
 *  1. User picks an action (IN / OUT / TRANSFER).
 *  2. Camera opens, html5-qrcode reads the QR.
 *  3. The QR is expected to encode a URL like
 *     https://<stocks-app>/products/<id>
 *     or
 *     https://<stocks-app>/serial/<id>
 *  4. On success, we redirect to /movements with prefilled query params
 *     so the existing MovementForm can pick them up.
 *
 * No external API call is needed at the parsing step — we trust the QR
 * payload because we generated it ourselves.
 */

type Action = 'IN' | 'OUT' | 'TRANSFER'

const ACTIONS: { key: Action; label: string; description: string; color: string; Icon: typeof ArrowDownCircle }[] = [
  {
    key: 'IN',
    label: 'Entrée de stock',
    description: "Réception d'un produit",
    color: 'from-emerald-500 to-emerald-600',
    Icon: ArrowDownCircle,
  },
  {
    key: 'OUT',
    label: 'Sortie de stock',
    description: 'Utilisation, vente, casse',
    color: 'from-rose-500 to-rose-600',
    Icon: ArrowUpCircle,
  },
  {
    key: 'TRANSFER',
    label: 'Transfert de stock',
    description: 'Entre deux sites',
    color: 'from-indigo-500 to-blue-600',
    Icon: ArrowLeftRight,
  },
]

interface ParsedQr {
  kind: 'product' | 'serial' | 'unknown'
  id: string
  raw: string
}

function parseQr(payload: string): ParsedQr {
  const raw = payload.trim()
  // Match /products/<id> or /serial/<id> anywhere in the URL.
  const productMatch = raw.match(/\/products\/([0-9a-f-]{8,})/i)
  if (productMatch) return { kind: 'product', id: productMatch[1], raw }
  const serialMatch = raw.match(/\/serial(?:-items)?\/([0-9a-f-]{8,})/i)
  if (serialMatch) return { kind: 'serial', id: serialMatch[1], raw }
  // Fallback: raw UUID
  if (/^[0-9a-f-]{8,}$/i.test(raw)) return { kind: 'product', id: raw, raw }
  return { kind: 'unknown', id: '', raw }
}

export default function Scan() {
  const navigate = useNavigate()
  const [action, setAction] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<any>(null)
  const containerId = 'qr-scanner-region'

  // Start / stop scanner when action changes.
  useEffect(() => {
    let active = true
    if (!action) return

    setError(null)
    setScanning(true)
    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        if (!active) return
        const { Html5Qrcode } = mod
        const scanner = new Html5Qrcode(containerId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            // First decode wins — stop the camera immediately.
            const parsed = parseQr(decoded)
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                if (!active) return
                if (parsed.kind === 'unknown') {
                  setError(`QR non reconnu : ${parsed.raw.slice(0, 60)}`)
                  setScanning(false)
                  setAction(null)
                  return
                }
                const params = new URLSearchParams({
                  scanAction: action,
                  ...(parsed.kind === 'product' ? { scanProductId: parsed.id } : { scanSerialId: parsed.id }),
                })
                navigate(`/movements?${params.toString()}`)
              })
          },
          () => {
            // ignore per-frame decode errors
          },
        )
      } catch (err: any) {
        if (!active) return
        console.error('Camera start failed:', err)
        setError(err?.message || 'Impossible d\'accéder à la caméra')
        setScanning(false)
        setAction(null)
      }
    })()

    return () => {
      active = false
      const sc = scannerRef.current
      if (sc) {
        sc.stop?.()
          .catch(() => {})
          .finally(() => sc.clear?.())
        scannerRef.current = null
      }
    }
  }, [action, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Scan</h1>
            <p className="text-xs text-slate-500">Mouvements de stock par QR code</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Quitter"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        )}

        {!action && (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-600">Choisissez l'opération à effectuer :</p>
            {ACTIONS.map(({ key, label, description, color, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAction(key)}
                className={`w-full rounded-2xl bg-gradient-to-br ${color} p-5 text-left text-white shadow-md transition active:scale-[0.98]`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold">{label}</div>
                    <div className="text-[12px] opacity-90">{description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {action && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                <Camera className="h-4 w-4" />
                {ACTIONS.find((a) => a.key === action)?.label}
              </div>
              <button
                type="button"
                onClick={() => setAction(null)}
                className="text-[12px] text-slate-500 hover:text-slate-900"
              >
                Changer
              </button>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-black">
              <div id={containerId} className="absolute inset-0" />
              {scanning && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
                  <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Recherche d'un QR…
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-[12px] text-slate-500">
              Pointez la caméra vers le QR code du produit
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
