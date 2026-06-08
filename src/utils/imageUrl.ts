// Resolve a relative /uploads/... path returned by the API into a full URL.
//
// The API returns image URLs like "/uploads/products/<uuid>.jpg" which the
// browser would otherwise resolve against the client's host (stocksdev.orkessi.com)
// and hit nginx — getting a 404. Prefixing with the API host fixes it.

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')

const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

export function getFullImageUrl(url: string | null | undefined): string {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}
