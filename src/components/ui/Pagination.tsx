import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from './cn'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems: _totalItems,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  const btnBase =
    'flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium transition-colors'
  const btnInactive =
    'text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text]'
  const btnActive =
    'bg-[--k-primary] text-white'

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex items-center gap-1">
        {currentPage > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className={`${btnBase} ${btnInactive}`} title="Première page">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button onClick={() => onPageChange(currentPage - 1)} className={`${btnBase} ${btnInactive}`} title="Page précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}

        {pageNumbers.map((pageNum, index) =>
          pageNum === '...' ? (
            <span key={`ellipsis-${index}`} className="flex h-8 w-8 items-center justify-center text-[--k-muted]">
              ...
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`${btnBase} ${pageNum === currentPage ? btnActive : btnInactive}`}
            >
              {pageNum}
            </button>
          )
        )}

        {currentPage < totalPages && (
          <>
            <button onClick={() => onPageChange(currentPage + 1)} className={`${btnBase} ${btnInactive}`} title="Page suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => onPageChange(totalPages)} className={`${btnBase} ${btnInactive}`} title="Dernière page">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
