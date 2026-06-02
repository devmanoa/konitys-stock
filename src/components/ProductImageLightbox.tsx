import { useEffect } from 'react'
import { Download, X } from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

interface Props {
  imageUrl?: string | null
  alt: string
  /** Used for the download filename. */
  downloadName?: string
  onClose: () => void
}

/**
 * Full-screen image preview. Click anywhere outside to close, ESC also closes,
 * a top-right toolbar offers download + close. Renders nothing when imageUrl
 * is falsy so callers can keep the call site simple.
 */
export default function ProductImageLightbox({ imageUrl, alt, downloadName, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!imageUrl) return null

  const fullUrl = getFullImageUrl(imageUrl)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={fullUrl}
          alt={alt}
          className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain bg-white p-4"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE
          }}
        />
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <a
            href={fullUrl}
            download={`${downloadName || alt}.png`}
            className="rounded-lg bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            title="Télécharger"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
