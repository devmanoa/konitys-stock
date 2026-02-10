import { forwardRef, useCallback } from 'react'
import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import { cn } from './cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, onKeyDown, ...props }, ref) => {
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (type === 'number') {
          const allowedKeys = [
            'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', '.', '-',
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
          ]
          if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
            return
          }
          if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
            e.preventDefault()
          }
        }
        onKeyDown?.(e)
      },
      [type, onKeyDown]
    )

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-[13px] font-medium text-[--k-text]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          onKeyDown={handleKeyDown}
          className={cn(
            'input-field',
            error && 'border-[--k-danger] focus:border-[--k-danger] focus:ring-red-100',
            props.disabled && 'bg-[--k-surface-2] text-[--k-muted] cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && <p className="text-[13px] text-[--k-danger]">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
