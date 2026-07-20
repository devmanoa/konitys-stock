import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Camera } from 'lucide-react'
import { parseQrPayload } from '../utils/qr'

/**
 * Reusable QR scanner. Lazy-imports html5-qrcode so the lib (~370 KB) is
 * only fetched when the modal actually opens.
 *
 * Formats supportés (voir src/utils/qr.ts) :
 *   - SZ:v1:PRODUCT:<REF>                  (produit géré en quantité)
 *   - SZ:v1:PRODUCT:<REF>:SN:<serial>      (produit avec N° série constructeur)
 *   - SZ:v1:ITEM:<internalId>              (article interne unique)
 *   - Legacy URL /products/<uuid>          (compat avec anciens QR imprimés)
 *   - Legacy URL /serial/<uuid>            (compat)
 *   - Bare UUID                            (compat)
 *
 * `id` peut être un UUID OU une référence (ex : IMPR-DNP-DS620) : le
 * backend `GET /products/:key` accepte les deux.
 */

export interface ParsedQr {
  kind: 'product' | 'serial' | 'item' | 'unknown'
  /**
   * Pour 'product' : UUID (legacy) ou référence (nouveau format SZ:v1).
   * Pour 'serial'  : UUID d'un ProductSerialItem.
   * Pour 'item'    : identifiant interne (ex : IMP-0001).
   * Pour 'unknown' : chaîne vide.
   */
  id: string
  /** Numéro de série constructeur si présent dans le QR (SZ:v1:PRODUCT:<REF>:SN:...). */
  serialNumber?: string
  raw: string
}

export function parseQr(payload: string): ParsedQr {
  const p = parseQrPayload(payload)
  switch (p.kind) {
    case 'product':
      return {
        kind: 'product',
        id: p.idOrRef,
        serialNumber: p.serialNumber,
        raw: p.raw,
      }
    case 'serial':
      return { kind: 'serial', id: p.id, raw: p.raw }
    case 'item':
      return { kind: 'item', id: p.itemId, raw: p.raw }
    default:
      return { kind: 'unknown', id: '', raw: p.raw }
  }
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

  // Stable ref to the latest onScan so the camera isn't torn down and rebuilt
  // every time the parent re-renders (which used to cause video flicker).
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

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
            // Same defensive try/catch as the unmount cleanup: stop() can
            // throw synchronously if the lib's state machine drifted.
            const finish = () => {
              if (!active) return
              onScanRef.current(parsed)
            }
            try {
              const p = scanner.stop()
              if (p && typeof p.catch === 'function') {
                p.catch(() => {}).finally(finish)
              } else {
                finish()
              }
            } catch {
              finish()
            }
          },
          () => {
            // ignore per-frame decode errors
          },
        )
      } catch (err: any) {
        if (!active) return
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Camera start failed:', err)
        }
        setError(err?.message || "Impossible d'accéder à la caméra")
        setScanning(false)
      }
    })()

    return () => {
      active = false
      const sc = scannerRef.current
      scannerRef.current = null
      if (!sc) return
      // html5-qrcode throws "Cannot stop, scanner is not running or paused"
      // synchronously when the scanner has already been stopped (which we do
      // ourselves inside the decode callback above). The promise never gets
      // a chance to reject, so .catch() doesn't help — we need a sync try.
      // Also guard via getState() when available so we skip the call entirely
      // when nothing is running.
      try {
        const state = typeof sc.getState === 'function' ? sc.getState() : null
        // 2 = SCANNING, 3 = PAUSED (from Html5QrcodeScannerState). Only stop
        // if the scanner is in one of those states.
        if (state == null || state === 2 || state === 3) {
          const p = sc.stop?.()
          if (p && typeof p.catch === 'function') {
            p.catch(() => {}).finally(() => {
              try { sc.clear?.() } catch { /* ignore */ }
            })
          } else {
            try { sc.clear?.() } catch { /* ignore */ }
          }
        } else {
          try { sc.clear?.() } catch { /* ignore */ }
        }
      } catch {
        // sync throw from stop() — ignore, the scanner is already dead.
        try { sc.clear?.() } catch { /* ignore */ }
      }
    }
  }, [isOpen])

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
