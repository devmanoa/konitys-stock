import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Loader2 } from 'lucide-react'
import api from '../../services/api'
import type { Supplier, PaginatedResponse } from '../../types'

interface SupplierSearchProps {
  onChange: (supplierId: string, supplier: Supplier | null) => void
  error?: string
  label?: string
  disabled?: boolean
  initialSupplier?: Supplier | null
  excludeIds?: string[]
}

export default function SupplierSearch({
  onChange,
  error,
  label = 'Fournisseur *',
  disabled = false,
  initialSupplier = null,
  excludeIds = [],
}: SupplierSearchProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(initialSupplier)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers-search', search],
    queryFn: async () => {
      if (!search || search.length < 1) return []
      const res = await api.get<PaginatedResponse<Supplier>>(
        `/suppliers?search=${encodeURIComponent(search)}&limit=15`
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
    setSelectedSupplier(initialSupplier)
    setSearch('')
  }, [initialSupplier])

  const handleSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    onChange(supplier.id, supplier)
    setSearch('')
    setIsOpen(false)
  }

  const handleClear = () => {
    setSelectedSupplier(null)
    onChange('', null)
    setSearch('')
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setIsOpen(true)
    if (selectedSupplier) {
      setSelectedSupplier(null)
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
        {selectedSupplier ? (
          <div
            className={`flex items-center justify-between rounded-lg border bg-[--k-surface] px-3 py-2 ${
              error ? 'border-[--k-danger]' : 'border-[--k-border]'
            }`}
            title={`${selectedSupplier.name}${selectedSupplier.contact ? ` - ${selectedSupplier.contact}` : ''}`}
          >
            <div className="flex-1 min-w-0 truncate">
              <span className="font-medium text-[13px] text-[--k-text]">{selectedSupplier.name}</span>
              {selectedSupplier.contact && (
                <span className="ml-2 text-[13px] text-[--k-muted]">- {selectedSupplier.contact}</span>
              )}
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
              placeholder="Rechercher un fournisseur..."
              disabled={disabled}
              className={`input-field pl-10 pr-10 ${
                error ? 'border-[--k-danger]' : ''
              } ${disabled ? 'bg-[--k-surface-2] cursor-not-allowed' : ''}`}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[--k-muted]" />
            )}
          </>
        )}

        {isOpen &&
          !selectedSupplier &&
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
                  Tapez pour rechercher un fournisseur...
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[--k-muted]" />
                  <span className="ml-2 text-[13px] text-[--k-muted]">Recherche...</span>
                </div>
              ) : suppliers && suppliers.length > 0 ? (
                (() => {
                  const filteredSuppliers = suppliers.filter((s) => !excludeIds.includes(s.id))
                  return filteredSuppliers.length > 0 ? (
                    <ul className="max-h-60 overflow-auto py-1">
                      {filteredSuppliers.map((supplier) => (
                        <li key={supplier.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(supplier)}
                            className="w-full px-4 py-2 text-left hover:bg-[--k-surface-2] transition"
                          >
                            <span className="font-medium text-[13px] text-[--k-text]">
                              {supplier.name}
                            </span>
                            {supplier.contact && (
                              <span className="ml-2 text-[13px] text-[--k-muted]">
                                - {supplier.contact}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                      {suppliers.length === 15 && (
                        <li className="px-4 py-2 text-[11px] text-[--k-muted] border-t border-[--k-border]">
                          Affinez votre recherche pour plus de résultats
                        </li>
                      )}
                    </ul>
                  ) : (
                    <div className="px-4 py-3 text-[13px] text-[--k-muted]">
                      Aucun fournisseur disponible pour "{search}"
                    </div>
                  )
                })()
              ) : (
                <div className="px-4 py-3 text-[13px] text-[--k-muted]">
                  Aucun fournisseur trouvé pour "{search}"
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
