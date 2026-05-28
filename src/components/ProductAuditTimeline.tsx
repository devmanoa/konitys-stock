import { useQuery } from '@tanstack/react-query'
import {
  PenLine,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Tag,
  Truck,
} from 'lucide-react'
import api from '../services/api'
import type { ApiResponse, ProductAuditEntry } from '../types'
import OperatorAvatar from './OperatorAvatar'

interface Props {
  productId: string
}

// Display name for each scalar field (matches the form labels).
const FIELD_LABELS: Record<string, string> = {
  reference: 'Référence',
  description: 'Description',
  supplyRisk: 'Risque appro',
  location: 'Emplacement',
  comment: 'Commentaire',
  imageUrl: 'Image',
  externalUrl: 'Lien externe',
  minStock: 'Seuil critique',
  hasSerialNumber: 'Suivi n° de série',
  assemblyId: 'Borne',
}

function actionIcon(action: string) {
  switch (action) {
    case 'created':
      return <Sparkles className="h-3.5 w-3.5" />
    case 'field':
      return <PenLine className="h-3.5 w-3.5" />
    case 'assembly_type_added':
    case 'assembly_type_qty':
      return <Layers className="h-3.5 w-3.5" />
    case 'assembly_type_removed':
      return <Trash2 className="h-3.5 w-3.5" />
    case 'part_category_added':
      return <Tag className="h-3.5 w-3.5" />
    case 'part_category_removed':
      return <Trash2 className="h-3.5 w-3.5" />
    case 'supplier_added':
      return <Truck className="h-3.5 w-3.5" />
    case 'supplier_removed':
      return <Trash2 className="h-3.5 w-3.5" />
    default:
      return <Plus className="h-3.5 w-3.5" />
  }
}

function actionDotColor(action: string) {
  if (action === 'created') return 'bg-emerald-500'
  if (action.endsWith('_added')) return 'bg-emerald-500'
  if (action.endsWith('_removed')) return 'bg-red-500'
  if (action === 'assembly_type_qty') return 'bg-amber-500'
  return 'bg-indigo-500'
}

function renderValue(v?: string | null) {
  if (v === null || v === undefined || v === '') {
    return <span className="italic text-[--k-muted]">vide</span>
  }
  return <span className="font-mono text-[12px]">{v}</span>
}

function renderEntry(entry: ProductAuditEntry) {
  const fieldLabel = entry.field
    ? FIELD_LABELS[entry.field] || entry.field
    : ''
  switch (entry.action) {
    case 'created':
      return <>Produit créé</>
    case 'field':
      return (
        <>
          <span className="font-medium text-[--k-text]">{fieldLabel}</span>{' '}
          modifié : {renderValue(entry.oldValue)} → {renderValue(entry.newValue)}
        </>
      )
    case 'assembly_type_added':
      return (
        <>
          Type de borne <span className="font-medium text-[--k-text]">{fieldLabel}</span>{' '}
          ajouté{entry.newValue ? <> (qté × {entry.newValue})</> : null}
        </>
      )
    case 'assembly_type_removed':
      return (
        <>
          Type de borne <span className="font-medium text-[--k-text]">{fieldLabel}</span>{' '}
          retiré
        </>
      )
    case 'assembly_type_qty':
      return (
        <>
          Qté/unité pour <span className="font-medium text-[--k-text]">{fieldLabel}</span> :{' '}
          {renderValue(entry.oldValue)} → {renderValue(entry.newValue)}
        </>
      )
    case 'part_category_added':
      return (
        <>
          Catégorie <span className="font-medium text-[--k-text]">{fieldLabel}</span> ajoutée
        </>
      )
    case 'part_category_removed':
      return (
        <>
          Catégorie <span className="font-medium text-[--k-text]">{fieldLabel}</span> retirée
        </>
      )
    case 'supplier_added':
      return (
        <>
          Fournisseur <span className="font-medium text-[--k-text]">{fieldLabel}</span>{' '}
          ajouté{entry.newValue ? <> ({entry.newValue})</> : null}
        </>
      )
    case 'supplier_removed':
      return (
        <>
          Fournisseur <span className="font-medium text-[--k-text]">{fieldLabel}</span>{' '}
          retiré{entry.oldValue ? <> ({entry.oldValue})</> : null}
        </>
      )
    default:
      return (
        <>
          {entry.action} {fieldLabel && <>— {fieldLabel}</>}
        </>
      )
  }
}

export default function ProductAuditTimeline({ productId }: Props) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['product-audit', productId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProductAuditEntry[]>>(
        `/products/${productId}/audit-log`,
      )
      return res.data?.data || []
    },
  })

  if (isLoading) {
    return (
      <p className="text-center text-sm text-[--k-muted] py-6">Chargement de l'historique…</p>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-center text-sm text-[--k-muted] py-6">
        Aucune modification enregistrée.
      </p>
    )
  }

  return (
    <ol className="relative ml-3 border-l border-[--k-border]">
      {entries.map((entry) => {
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
  )
}
