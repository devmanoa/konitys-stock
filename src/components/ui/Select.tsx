import { forwardRef } from 'react'
import type { SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: SelectOption[]
  placeholder?: string
  children?: ReactNode
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, children, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-[13px] font-medium text-[--k-text]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'input-field',
            error && 'border-[--k-danger] focus:border-[--k-danger] focus:ring-red-100',
            props.disabled && 'bg-[--k-surface-2] text-[--k-muted] cursor-not-allowed',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children
            ? children
            : options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
        </select>
        {error && <p className="text-[13px] text-[--k-danger]">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
