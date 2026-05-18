import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import type { StockMovement } from '../types'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function MovementDetail({ movement }: { movement: StockMovement }) {
  const typeLabel =
    movement.type === 'IN' ? 'Entrée' : movement.type === 'OUT' ? 'Sortie' : 'Transfert'
  const typeColor =
    movement.type === 'IN'
      ? 'text-green-600'
      : movement.type === 'OUT'
        ? 'text-red-600'
        : 'text-blue-600'
  const sign = movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-start justify-between gap-3 rounded-xl bg-[--k-surface-2]/40 p-3">
        <div>
          <div className={`text-2xl font-bold ${typeColor}`}>
            {sign}
            {movement.quantity}{' '}
            <span className="text-sm font-medium text-[--k-muted]">
              ({movement.condition === 'NEW' ? 'Neuf' : 'Occasion'})
            </span>
          </div>
          <div className="mt-1 text-sm text-[--k-muted]">
            {typeLabel}{' '}
            {movement.sourceSite && movement.targetSite
              ? `: ${movement.sourceSite.name} → ${movement.targetSite.name}`
              : movement.targetSite
                ? `vers ${movement.targetSite.name}`
                : movement.sourceSite
                  ? `depuis ${movement.sourceSite.name}`
                  : ''}
          </div>
        </div>
      </div>

      {/* Product */}
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">Produit</div>
        <Link
          to={`/products/${movement.productId}`}
          className="mt-1 block font-medium text-[--k-primary] hover:underline"
        >
          {movement.product?.description || movement.product?.reference}
        </Link>
        {movement.product?.description && (
          <div className="text-xs font-mono text-[--k-muted]">{movement.product.reference}</div>
        )}
      </div>

      {/* Dates + operator grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">
            Date du mouvement
          </div>
          <div className="mt-1 text-sm text-[--k-text]">{fmtDate(movement.movementDate)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">Saisi le</div>
          <div className="mt-1 text-sm text-[--k-text]">{fmtDateTime(movement.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">Opérateur</div>
          <div className="mt-1 flex items-center gap-1 text-sm text-[--k-text]">
            <User className="h-3.5 w-3.5 text-[--k-muted]" />
            {movement.operator || <span className="italic text-[--k-muted]">Non renseigné</span>}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">
            État du produit
          </div>
          <div className="mt-1 text-sm text-[--k-text]">
            {movement.condition === 'NEW' ? 'Neuf' : 'Occasion'}
          </div>
        </div>
        {movement.sourceSite && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">
              Site source
            </div>
            <div className="mt-1 text-sm text-[--k-text]">{movement.sourceSite.name}</div>
          </div>
        )}
        {movement.targetSite && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">
              Site cible
            </div>
            <div className="mt-1 text-sm text-[--k-text]">{movement.targetSite.name}</div>
          </div>
        )}
      </div>

      {/* Comment */}
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[--k-muted]">Commentaire</div>
        <div className="mt-1 whitespace-pre-wrap rounded-lg border border-[--k-border] bg-[--k-surface] p-3 text-sm text-[--k-text]">
          {movement.comment || <span className="italic text-[--k-muted]">Aucun commentaire</span>}
        </div>
      </div>
    </div>
  )
}
