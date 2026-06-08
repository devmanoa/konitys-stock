import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Camera } from 'lucide-react'

/**
 * Reusable QR scanner. Lazy-imports html5-qrcode so the lib (~370 KB) is
 * only fetched when the modal actually opens.
 *
 * Caller passes an onScan(parsed) callback. We support the two URL shapes
 * the app generates:
 *   - /products/<uuid>   (product type)
 *   - /serial/<uuid>     (single serial-tracked item)
 * Plus a bare UUID fallback. Anything else is reported as 'unknown'.
 */

export interface ParsedQr {
  kind: 'product' | 'serial' | 'unknown'
  id: string
  raw: string
}

export function parseQr(payload: string): ParsedQr {
  const raw = payload.trim()
  const productMatch = raw.match(/\/products\/([0-9a-f-]{8,})/i)
  if (productMatch) return { kind: 'product', id: productMatch[1], raw }
  const serialMatch = raw.match(/\/serial(?:-items)?\/([0-9a-f-]{8,})/i)
  if (serialMatch) return { kind: 'serial', id: serialMatch[1], raw }
  if (/^[0-9a-f-]{8,}$/i.test(raw)) return { kind: 'product', id: raw, raw }
  return { kind: 'unknown', id: '', raw }
}

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Fires once when a valid QR is decoded. The camera is stopped before this is called. */
  onScan: (parsed: ParsedQr) => void
  /** Optional title shown in the modal header. */
  title?: string
  /** Optional helper text under the camera. */
  hint?: string
}

const CONTAINER_ID = 'qr-scanner-modal-region'

export default function QrScannerModal({ isOpen, onClose, onScan, title = 'Scanner un QR code', hint }: Props) {
  const scannerRef = useRef<any>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setError(null)
    setScanning(true)

    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        if (!active) return
        const { Html5Qrcode } = mod
        const scanner = new Html5Qrcode(CONTAINER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const parsed = parseQr(decoded)
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                if (!active) return
                onScan(parsed)
              })
          },
          () => {
            // ignore per-frame decode errors
          },
        )
      } catch (err: any) {
        if (!active) return
        console.error('Camera start failed:', err)
        setError(err?.message || "Impossible d'accéder à la caméra")
        setScanning(false)
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
  }, [isOpen, onScan])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {title}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        ) : (
          <>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-black">
              <div id={CONTAINER_ID} className="absolute inset-0" />
              {scanning && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3">
                  <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Recherche d'un QR…
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-[12px] text-slate-500">
              {hint || 'Pointez la caméra vers le QR code du produit'}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
