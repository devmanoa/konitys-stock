import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from './cn'

interface SearchSelectOption {
  value: string
  label: string
}

interface SearchSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  className,
  disabled,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selectedLabel = options.find((o) => o.value === value)?.label || ''

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function handleScroll() {
      updatePosition()
    }
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [open, updatePosition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  return (
    <>
      <div className={className}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              if (!open) updatePosition()
              setOpen((v) => !v)
              setSearch('')
            }
          }}
          className={cn(
            'input-field flex items-center justify-between gap-2 text-left',
            disabled && 'bg-[--k-surface-2] text-[--k-muted] cursor-not-allowed',
            !value && 'text-[--k-muted]'
          )}
        >
          <span className="truncate text-[13px]">
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[--k-muted]" />
        </button>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded-xl border border-[--k-border] bg-white shadow-lg shadow-black/8"
        >
          <div className="flex items-center gap-2 border-b border-[--k-border] px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[--k-muted]" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[--k-muted]/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[--k-muted] hover:text-[--k-text]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-[200px] overflow-y-auto py-1">
            {/* Option to clear / select placeholder */}
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
                setSearch('')
              }}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-[13px] text-[--k-muted] hover:bg-[--k-surface-2] transition',
                !value && 'bg-[--k-surface-2] font-medium'
              )}
            >
              {placeholder}
            </button>

            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  setSearch('')
                }}
                className={cn(
                  'flex w-full items-center px-3 py-1.5 text-[13px] text-[--k-text] hover:bg-[--k-surface-2] transition',
                  option.value === value && 'bg-[--k-surface-2] font-medium text-[--k-primary]'
                )}
              >
                {option.label}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-[13px] text-[--k-muted]">
                Aucun résultat
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
