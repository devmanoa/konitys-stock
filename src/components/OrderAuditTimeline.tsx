import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PenLine,
  Plus,
  Sparkles,
  PackageCheck,
  AlertTriangle,
  Paperclip,
  Trash2,
  CircleDot,
  ChevronDown,
} from 'lucide-react'
import api from '../services/api'
import type { ApiResponse, OrderAuditEntry } from '../types'
import OperatorAvatar from './OperatorAvatar'

const INITIAL_VISIBLE = 10
const STEP = 10

interface Props {
  orderId: string
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Titre',
  orderDate: 'Date de commande',
  expectedDate: 'Réception prévue',
  destinationSiteId: 'Site de destination',
  responsible: 'Responsable',
  supplierRef: 'Réf. fournisseur',
  comment: 'Commentaire',
  shippingCost: 'Frais de livraison',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En cours',
  PARTIAL: 'Reçu partiellement',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
}

function actionIcon(action: string) {
  switch (action) {
    case 'created':
      return <Sparkles className="h-3.5 w-3.5" />
    case 'field':
      return <PenLine className="h-3.5 w-3.5" />
    case 'status':
      return <CircleDot className="h-3.5 w-3.5" />
    case 'item_received':
      return <PackageCheck className="h-3.5 w-3.5" />
    case 'item_anomaly':
      return <AlertTriangle className="h-3.5 w-3.5" />
    case 'attachment_added':
      return <Paperclip className="h-3.5 w-3.5" />
    case 'attachment_removed':
      return <Trash2 className="h-3.5 w-3.5" />
    default:
      return <Plus className="h-3.5 w-3.5" />
  }
}

function actionDotColor(action: string) {
  if (action === 'created') return 'bg-emerald-500'
  if (action === 'status') return 'bg-indigo-500'
  if (action === 'item_received') return 'bg-emerald-500'
  if (action === 'item_anomaly') return 'bg-amber-500'
  if (action === 'attachment_added') return 'bg-blue-500'
  if (action === 'attachment_removed') return 'bg-red-500'
  return 'bg-indigo-500'
}

function fmtValue(v?: string | null) {
  if (v === null || v === undefined || v === '') {
    return <span className="italic text-[--k-muted]">vide</span>
  }
  return <span className="font-mono text-[12px]">{v}</span>
}

function renderEntry(entry: OrderAuditEntry) {
  const fieldLabel = entry.field
    ? FIELD_LABELS[entry.field] || entry.field
    : ''
  switch (entry.action) {
    case 'created':
      return <>Commande créée</>
    case 'field':
      return (
        <>
          <span className="font-medium text-[--k-text]">{fieldLabel}</span> modifié :{' '}
          {fmtValue(entry.oldValue)} → {fmtValue(entry.newValue)}
        </>
      )
    case 'status': {
      const from = entry.oldValue ? STATUS_LABELS[entry.oldValue] || entry.oldValue : null
      const to = entry.newValue ? STATUS_LABELS[entry.newValue] || entry.newValue : null
      return (
        <>
          Statut :{' '}
          {from && <span className="font-mono text-[12px]">{from}</span>}
          {from && to && ' → '}
          {to && <span className="font-mono text-[12px] font-medium">{to}</span>}
        </>
      )
    }
    case 'item_received':
      return (
        <>
          <span className="font-medium text-[--k-text]">{fieldLabel}</span> réceptionné{' '}
          ({entry.newValue ?? '?'} unité{Number(entry.newValue) > 1 ? 's' : ''})
        </>
      )
    case 'item_anomaly': {
      const [qty, ...rest] = (entry.newValue || '').split('|')
      const comment = rest.join('|')
      const decisionLabel = entry.oldValue === 'ACCEPTED' ? 'Acceptée' : 'Refusée'
      return (
        <>
          Anomalie sur <span className="font-medium text-[--k-text]">{fieldLabel}</span> —{' '}
          {qty || '?'} unité{Number(qty) > 1 ? 's' : ''} ({decisionLabel})
          {comment && <span className="block text-[11px] italic text-[--k-muted]">{comment}</span>}
        </>
      )
    }
    case 'attachment_added':
      return (
        <>
          Pièce jointe ajoutée :{' '}
          <span className="font-mono text-[12px]">{fieldLabel}</span>
        </>
      )
    case 'attachment_removed':
      return (
        <>
          Pièce jointe supprimée :{' '}
          <span className="font-mono text-[12px] line-through opacity-70">{fieldLabel}</span>
        </>
      )
    default:
      return (
        <>
          {entry.action}
          {fieldLabel && <> — {fieldLabel}</>}
        </>
      )
  }
}

export default function OrderAuditTimeline({ orderId }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const { data: entries, isLoading } = useQuery({
    queryKey: ['order-audit', orderId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OrderAuditEntry[]>>(
        `/orders/${orderId}/audit-log`,
      )
      return res.data?.data || []
    },
  })

  if (isLoading) {
    return (
      <p className="text-center text-sm text-[--k-muted] py-6">
        Chargement de l'historique…
      </p>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-center text-sm text-[--k-muted] py-6">
        Aucune activité enregistrée.
      </p>
    )
  }

  const visibleEntries = entries.slice(0, visibleCount)
  const remaining = entries.length - visibleEntries.length

  return (
    <>
      <ol className="relative ml-3 border-l border-[--k-border]">
        {visibleEntries.map((entry) => {
          const date = new Date(entry.changedAt)
          return (
            <li key={entry.id} className="ml-4 pb-4 last:pb-0">
              <span
                className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-[--k-surface] ${actionDotColor(entry.action)}`}
              >
                <span className="text-white">{actionIcon(entry.action)}</span>
              </span>
              <div className="flex flex-col gap-1">
                <div className="text-[13px] text-[--k-text]">{renderEntry(entry)}</div>
                <div className="flex items-center gap-2 text-[11px] text-[--k-muted]">
                  <span className="tabular-nums">
                    {date.toLocaleDateString('fr-FR')} ·{' '}
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>·</span>
                  <OperatorAvatar name={entry.changedByName} size="xs" />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {remaining > 0 && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + STEP)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-1.5 text-[12px] font-medium text-[--k-muted] hover:text-[--k-text] hover:border-[--k-primary] transition"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Afficher plus ({remaining})
          </button>
        </div>
      )}
    </>
  )
}
