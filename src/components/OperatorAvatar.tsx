import { getOperatorInitials, getOperatorColor } from '../utils/operatorAvatar'
import { cn } from './ui/cn'

interface OperatorAvatarProps {
  name?: string | null
  /** Show the name to the right of the circle. Default: true. */
  showName?: boolean
  /** Size of the circle. Default 'sm' (h-5 w-5). */
  size?: 'xs' | 'sm' | 'md'
  className?: string
  /** Text shown when name is empty/null. Default: '—'. */
  fallback?: string
}

const SIZE = {
  xs: { circle: 'h-4 w-4 text-[9px]', text: 'text-[11px]' },
  sm: { circle: 'h-5 w-5 text-[10px]', text: 'text-[12px]' },
  md: { circle: 'h-6 w-6 text-[11px]', text: 'text-sm' },
}

export default function OperatorAvatar({
  name,
  showName = true,
  size = 'sm',
  className,
  fallback = '—',
}: OperatorAvatarProps) {
  if (!name) {
    return <span className={cn('text-[--k-muted]', className)}>{fallback}</span>
  }
  const cls = SIZE[size]
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full font-semibold',
          cls.circle,
          getOperatorColor(name),
        )}
        title={name}
      >
        {getOperatorInitials(name)}
      </span>
      {showName && (
        <span className={cn('text-[--k-text] truncate', cls.text)}>{name}</span>
      )}
    </span>
  )
}
