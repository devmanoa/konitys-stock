/**
 * Spinner partagé — remplace le markup dupliqué
 * `animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent`
 * présent dans la plupart des pages.
 *
 * - `SpinnerIcon` : juste le rond qui tourne (usage inline, ex. à côté d'un bouton).
 * - `Spinner` (default) : rond centré dans un conteneur flex, avec label optionnel
 *   ("Chargement..."). Le padding/la hauteur du conteneur se passent via `className`.
 */

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export function SpinnerIcon({
  size = 'md',
  className = '',
}: {
  size?: SpinnerSize
  className?: string
}) {
  return (
    <div
      className={`${SIZE_CLASS[size]} animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent ${className}`.trim()}
    />
  )
}

interface SpinnerProps {
  /** Taille du rond : sm = h-5, md = h-6 (défaut), lg = h-8. */
  size?: SpinnerSize
  /** Texte optionnel affiché à droite du rond (ex. "Chargement..."). */
  label?: string
  /** Classes ajoutées au conteneur centré (padding, hauteur...). */
  className?: string
}

export default function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <SpinnerIcon size={size} />
      {label && <span className="ml-2 text-[--k-muted]">{label}</span>}
    </div>
  )
}
