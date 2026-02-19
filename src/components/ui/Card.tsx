import type { ReactNode } from 'react'
import { cn } from './cn'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[--k-border] bg-[--k-surface] shadow-sm shadow-black/[0.03]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-4 pt-3 pb-3 border-b border-[--k-border]', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <div className={cn('text-lg font-semibold text-[--k-text]', className)}>{children}</div>
}

export function CardDescription({ children, className }: CardProps) {
  return <div className={cn('text-xs text-[--k-muted] mt-0.5', className)}>{children}</div>
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-4 pb-3 pt-3', className)}>{children}</div>
}
