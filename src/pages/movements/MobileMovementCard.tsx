import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, ArrowRight, ChevronDown,
} from 'lucide-react'
import OperatorAvatar from '../../components/OperatorAvatar'
import RichTextDisplay from '../../components/ui/RichTextDisplay'
import type { StockMovement } from '../../types'

/**
 * Mobile-only compact movement card.
 *
 * Default state: ONE row at a glance — type pill, date, qty, product, sites.
 * Tap anywhere to toggle the expand: operator + condition + comment.
 *
 * Long-press / right-arrow keeps the link to /products/:id reachable.
 *
 * Rendered only under `sm:hidden` — desktop uses the table.
 */
export default function MobileMovementCard({
  movement,
  onOpenDetail,
}: {
  movement: StockMovement
  onOpenDetail: (m: StockMovement) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const typeStyles =
    movement.type === 'IN'
      ? 'bg-emerald-50 text-emerald-700'
      : movement.type === 'OUT'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-blue-50 text-blue-700'

  const TypeIcon =
    movement.type === 'IN'
      ? ArrowDownCircle
      : movement.type === 'OUT'
        ? ArrowUpCircle
        : ArrowLeftRight

  const qtyColor =
    movement.type === 'IN'
      ? 'text-emerald-700'
      : movement.type === 'OUT'
        ? 'text-rose-700'
        : 'text-blue-700'

  const qtyPrefix = movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '−' : ''

  const dateStr = new Date(movement.movementDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })

  return (
    <div className="rounded-xl border border-[--k-border] bg-[--k-surface]">
      {/* Compact header row — always visible. Tap = toggle expand. */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeStyles}`}
        >
          <TypeIcon className="h-3 w-3" />
          {movement.type === 'IN' ? 'Entrée' : movement.type === 'OUT' ? 'Sortie' : 'Transfert'}
        </span>

        <span className="font-mono text-[11px] text-[--k-muted] shrink-0">{dateStr}</span>

        <span className={`ml-auto font-bold tabular-nums text-[15px] ${qtyColor}`}>
          {qtyPrefix}
          {movement.quantity}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-[--k-muted] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Product + sites — second always-visible line. */}
      <div className="px-3 pb-2.5 -mt-1">
        <Link
          to={`/products/${movement.productId}`}
          onClick={(e) => e.stopPropagation()}
          className="block text-[13px] font-medium text-[--k-text] truncate"
        >
          {movement.product?.description || movement.product?.reference || 'Produit inconnu'}
        </Link>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[--k-muted]">
          {movement.sourceSite && movement.targetSite ? (
            <>
              <span className="truncate">{movement.sourceSite.name}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{movement.targetSite.name}</span>
            </>
          ) : (
            <span className="truncate">
              {movement.targetSite?.name || movement.sourceSite?.name || '—'}
            </span>
          )}
        </div>
      </div>

      {/* Expandable: condition + operator + comment + open detail. */}
      {expanded && (
        <div className="border-t border-[--k-border] px-3 py-2.5 space-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-[--k-muted]">État</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                movement.condition === 'NEW'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {movement.condition === 'NEW' ? 'Neuf' : 'Occasion'}
            </span>
          </div>

          {movement.operator && (
            <div className="flex items-center justify-between">
              <span className="text-[--k-muted]">Opérateur</span>
              <OperatorAvatar name={movement.operator} size="xs" />
            </div>
          )}

          {movement.comment && (
            <div>
              <div className="text-[--k-muted] mb-0.5">Commentaire</div>
              <RichTextDisplay content={movement.comment} className="text-[--k-text]" emptyFallback={null} />
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetail(movement)
            }}
            className="w-full mt-1 py-2 rounded-lg border border-[--k-border] text-[12px] font-medium text-[--k-primary]"
          >
            Voir le détail complet
          </button>
        </div>
      )}
    </div>
  )
}
