import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Loader2 } from 'lucide-react'
import Button from './ui/Button'

/**
 * Print QR-code labels for a product, product type or any business object.
 * Wraps a print-friendly preview that targets the Zebra ZD411D (203 dpi
 * thermal printer) but renders as a normal browser print, so any printer
 * with a roll matching one of the supported sizes will work.
 */

export type LabelPayload = {
  /** Value encoded inside the QR. Could be a URL or an internal ID. */
  qrValue: string
  /** Title shown under the QR (product name). */
  title?: string
  /** Reference shown small under the title. */
  reference?: string
}

type LabelFormat = 'full-57x32' | 'full-102x50' | 'light-40x25'
type LabelMode = 'full' | 'light'

interface PrintLabelsProps {
  isOpen: boolean
  onClose: () => void
  /** One label per item — typically one item, or one per serial number. */
  labels: LabelPayload[]
  /** Initial mode. Default 'full'. */
  defaultMode?: LabelMode
}

const FORMATS: Record<
  LabelFormat,
  {
    label: string
    widthMm: number
    heightMm: number
    qrSize: number
    description: string
  }
> = {
  'full-57x32': {
    label: '57 × 32 mm — complet',
    widthMm: 57,
    heightMm: 32,
    qrSize: 22,
    description: 'QR + nom + référence. Format standard ZD411D.',
  },
  'full-102x50': {
    label: '102 × 50 mm — large',
    widthMm: 102,
    heightMm: 50,
    qrSize: 38,
    description: 'Plus large, plus de place pour le texte.',
  },
  'light-40x25': {
    label: '40 × 25 mm — QR seul',
    widthMm: 40,
    heightMm: 25,
    qrSize: 20,
    description: 'Que le QR code, sans texte.',
  },
}

export default function PrintLabels({ isOpen, onClose, labels, defaultMode = 'full' }: PrintLabelsProps) {
  const [format, setFormat] = useState<LabelFormat>(
    defaultMode === 'light' ? 'light-40x25' : 'full-57x32',
  )
  const [qrDataUrls, setQrDataUrls] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setGenerating(true)
    // Import dynamique : la lib `qrcode` n'est téléchargée qu'à la première
    // ouverture de la modale, pas au chargement de la page.
    import('qrcode')
      .then(({ default: QRCode }) =>
        Promise.all(
          labels.map((l) =>
            QRCode.toDataURL(l.qrValue, {
              margin: 0,
              errorCorrectionLevel: 'M',
              width: 512,
            }),
          ),
        ),
      )
      .then((urls) => {
        if (!cancelled) setQrDataUrls(urls)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrls([])
      })
      .finally(() => {
        if (!cancelled) setGenerating(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, labels])

  if (!isOpen) return null

  const f = FORMATS[format]
  const isLight = format === 'light-40x25'

  const handlePrint = () => {
    if (!previewRef.current) return
    const html = previewRef.current.innerHTML
    const win = window.open('', '_blank', 'width=600,height=400')
    if (!win) return
    win.document.write(`<!doctype html>
<html>
  <head>
    <title>Étiquettes</title>
    <style>
      @page { size: ${f.widthMm}mm ${f.heightMm}mm; margin: 0; }
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; }
        .pl-label { page-break-after: always; break-after: page; }
        .pl-label:last-child { page-break-after: auto; break-after: auto; }
      }
      body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
      .pl-label {
        width: ${f.widthMm}mm;
        height: ${f.heightMm}mm;
        box-sizing: border-box;
        padding: 2mm;
        display: flex;
        align-items: center;
        gap: 3mm;
        overflow: hidden;
      }
      .pl-label.light { justify-content: center; gap: 0; padding: 1mm; }
      .pl-qr { width: ${f.qrSize}mm; height: ${f.qrSize}mm; flex-shrink: 0; }
      .pl-text { display: flex; flex-direction: column; justify-content: center; min-width: 0; flex: 1; }
      .pl-title { font-size: 9pt; font-weight: 600; line-height: 1.15; word-break: break-word; }
      .pl-ref { font-size: 7pt; color: #444; margin-top: 1mm; font-family: ui-monospace, monospace; }
    </style>
  </head>
  <body>${html}</body>
</html>`)
    win.document.close()
    win.focus()
    // Give the browser a tick to render the images before triggering print.
    setTimeout(() => {
      win.print()
      win.close()
    }, 250)
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-2 sm:mx-4 max-h-[90vh] overflow-hidden rounded-2xl border border-[--k-border] bg-[--k-surface] shadow-xl">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-[15px] font-semibold text-[--k-text]">
            Imprimer {labels.length > 1 ? `${labels.length} étiquettes` : 'une étiquette'}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Format chooser */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[--k-text]">
              Format d'étiquette
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(FORMATS) as LabelFormat[]).map((key) => {
                const opt = FORMATS[key]
                const active = format === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormat(key)}
                    className={`text-left rounded-xl border p-3 text-[12px] transition ${
                      active
                        ? 'border-[--k-primary] bg-[--k-primary-2]/30 text-[--k-text]'
                        : 'border-[--k-border] bg-[--k-surface] text-[--k-muted] hover:border-[--k-primary]/50 hover:text-[--k-text]'
                    }`}
                  >
                    <div className="font-medium text-[13px] text-[--k-text]">{opt.label}</div>
                    <div className="mt-1 text-[11px]">{opt.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-medium text-[--k-text]">Aperçu</label>
              <span className="text-[11px] text-[--k-muted]">
                {f.widthMm} × {f.heightMm} mm — {labels.length} étiquette{labels.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="rounded-xl border border-dashed border-[--k-border] bg-white p-4 max-h-[260px] overflow-auto">
              {generating ? (
                <div className="flex h-32 items-center justify-center text-[--k-muted]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div ref={previewRef} className="flex flex-wrap gap-3">
                  {labels.map((l, i) => (
                    <div
                      key={i}
                      className={`pl-label ${isLight ? 'light' : ''}`}
                      style={{
                        width: `${f.widthMm}mm`,
                        height: `${f.heightMm}mm`,
                        padding: isLight ? '1mm' : '2mm',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isLight ? 'center' : 'flex-start',
                        gap: isLight ? 0 : '3mm',
                        border: '1px dashed #d1d5db',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        background: 'white',
                      }}
                    >
                      {qrDataUrls[i] && (
                        <img
                          src={qrDataUrls[i]}
                          alt="QR"
                          className="pl-qr"
                          style={{ width: `${f.qrSize}mm`, height: `${f.qrSize}mm`, flexShrink: 0 }}
                        />
                      )}
                      {!isLight && (
                        <div
                          className="pl-text"
                          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}
                        >
                          {l.title && (
                            <div
                              className="pl-title"
                              style={{ fontSize: '9pt', fontWeight: 600, lineHeight: 1.15, wordBreak: 'break-word' }}
                            >
                              {l.title}
                            </div>
                          )}
                          {l.reference && (
                            <div
                              className="pl-ref"
                              style={{ fontSize: '7pt', color: '#444', marginTop: '1mm', fontFamily: 'ui-monospace, monospace' }}
                            >
                              {l.reference}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[--k-border] px-4 sm:px-6 py-3">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handlePrint} disabled={generating || labels.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
