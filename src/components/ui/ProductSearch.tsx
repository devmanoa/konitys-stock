import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Loader2 } from 'lucide-react'
import api from '../../services/api'
import type { Product, PaginatedResponse } from '../../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

interface ProductSearchProps {
  onChange: (productId: string, product: Product | null) => void
  error?: string
  label?: string
  disabled?: boolean
  initialProduct?: Product | null
}

export default function ProductSearch({
  onChange,
  error,
  label = 'Produit *',
  disabled = false,
  initialProduct = null,
}: ProductSearchProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-search', search],
    queryFn: async () => {
      if (!search || search.length < 1) return []
      const res = await api.get<PaginatedResponse<Product>>(
        `/products?search=${encodeURIComponent(search)}&limit=15`
      )
      return res.data?.data
    },
    enabled: search.length >= 1,
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target)
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(target)
      if (isOutsideWrapper && isOutsideDropdown) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isOpen, search])

  useEffect(() => {
    setSelectedProduct(initialProduct)
    setSearch('')
  }, [initialProduct])

  const handleSelect = (product: Product) => {
    setSelectedProduct(product)
    onChange(product.id, product)
    setSearch('')
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedProduct(null)
    onChange('', null)
    setSearch('')
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setIsOpen(true)
    if (selectedProduct) {
      setSelectedProduct(null)
      onChange('', null)
    }
  }

  const handleInputFocus = () => {
    if (search.length >= 1) setIsOpen(true)
  }

  return (
    <div className="space-y-1" ref={wrapperRef}>
      {label && (
        <label className="block text-[13px] font-medium text-[--k-text]">{label}</label>
      )}

      <div className="relative" ref={inputContainerRef}>
        {selectedProduct ? (
          <div
            className={`flex items-center justify-between rounded-lg border bg-[--k-surface] px-3 py-2 ${
              error ? 'border-[--k-danger]' : 'border-[--k-border]'
            }`}
            title={`${selectedProduct.description || selectedProduct.reference}${selectedProduct.description ? ` (${selectedProduct.reference})` : ''}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img
                src={getFullImageUrl(selectedProduct.imageUrl)}
                alt=""
                className="h-8 w-8 rounded object-cover bg-[--k-surface-2] flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE }}
              />
              <div className="truncate">
                <span className="font-medium text-[13px] text-[--k-text]">
                  {selectedProduct.description || selectedProduct.reference}
                </span>
                {selectedProduct.description && (
                  <span className="ml-2 text-[13px] text-[--k-muted]">({selectedProduct.reference})</span>
                )}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-2 flex-shrink-0 p-1 text-[--k-muted] hover:text-[--k-text]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Rechercher un produit..."
              disabled={disabled}
              className={`input-field !pl-10 pr-10 ${
                error ? 'border-[--k-danger]' : ''
              } ${disabled ? 'bg-[--k-surface-2] cursor-not-allowed' : ''}`}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[--k-muted]" />
            )}
          </>
        )}

        {isOpen &&
          !selectedProduct &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[9999] rounded-xl border border-[--k-border] bg-[--k-surface] shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
            >
              {search.length < 1 ? (
                <div className="px-4 py-3 text-[13px] text-[--k-muted]">
                  Tapez pour rechercher un produit...
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[--k-muted]" />
                  <span className="ml-2 text-[13px] text-[--k-muted]">Recherche...</span>
                </div>
              ) : products && products.length > 0 ? (
                <ul className="max-h-60 overflow-auto py-1">
                  {products.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(product)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[--k-surface-2] transition"
                      >
                        <img
                          src={getFullImageUrl(product.imageUrl)}
                          alt=""
                          className="h-8 w-8 rounded object-cover bg-[--k-surface-2] flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-[13px] text-[--k-text] block truncate">
                            {product.description || product.reference}
                          </span>
                          {product.description && (
                            <span className="text-[11px] text-[--k-muted]">
                              {product.reference}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                  {products.length === 15 && (
                    <li className="px-4 py-2 text-[11px] text-[--k-muted] border-t border-[--k-border]">
                      Affinez votre recherche pour plus de résultats
                    </li>
                  )}
                </ul>
              ) : (
                <div className="px-4 py-3 text-[13px] text-[--k-muted]">
                  Aucun produit trouvé pour "{search}"
                </div>
              )}
            </div>,
            document.body
          )}
      </div>

      {error && <p className="text-[13px] text-[--k-danger]">{error}</p>}
    </div>
  )
}
