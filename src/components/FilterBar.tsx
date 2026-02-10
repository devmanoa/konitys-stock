import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

interface FilterBarProps {
  search: string
  onSearch: (value: string) => void
  placeholder?: string
  right?: ReactNode
}

export function FilterBar({ search, onSearch, placeholder = 'Rechercher…', right }: FilterBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[--k-muted]" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="input-field pl-8"
        />
      </div>
      {right}
    </div>
  )
}
