import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeClasses[size]} mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden rounded-2xl border border-[--k-border] bg-[--k-surface] shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 sm:px-6 py-3 sm:py-4">
          <h2 className="text-[15px] font-semibold text-[--k-text] pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(95vh-6rem)] sm:max-h-[calc(90vh-8rem)] overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
