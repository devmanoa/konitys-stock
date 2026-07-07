import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Loader2, GitCompareArrows, CheckCircle2, AlertTriangle,
  ClipboardList, Wand2, FileSpreadsheet,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import api from '../../services/api'
import { getFullImageUrl } from '../../utils/imageUrl'
import type { ApiResponse } from '../../types'
import type { Inventory } from './types'

interface CompareLine {
  productId: string
  reference: string
  description: string | null
  imageUrl: string | null
  hasSerialNumber: boolean
  counted: number
  theoretical: number
  gap: number
}

interface CompareData {
  inventory: Inventory
  lines: CompareLine[]
  totals: {
    productsCounted: number
    productsWithGap: number
    totalSurplus: number
    totalMissing: number
  }
}

export default function InventoryCompare() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'gap' | 'surplus' | 'missing'>('gap')

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-compare', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CompareData>>(`/inventories/${id}/compare`)
      return res.data?.data
    },
    enabled: !!id,
  })

  const handleExport = async () => {
    const res = await api.get(`/inventories/${id}/export?tab=compare&filter=${filter}`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const name = (data?.inventory?.name || 'inventaire').replace(/[^a-zA-Z0-9_-]+/g, '_')
    a.download = `${name}_comparaison_${filter}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ movementsCreated: number }>>(
        `/inventories/${id}/apply-corrections`,
      )
      return res.data?.data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['inventory', id] })
      qc.invalidateQueries({ queryKey: ['inventory-compare', id] })
      qc.invalidateQueries({ queryKey: ['inventories'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      alert(`${data?.movementsCreated ?? 0} mouvement(s) de correction créé(s).`)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Erreur lors de la génération des mouvements')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[--k-muted]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Comparaison" subtitle="Erreur de chargement">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/inventory/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </PageHeader>
        <Card>
          <CardContent>
            <p className="text-[--k-danger]">Impossible de charger la comparaison.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { inventory: inv, lines, totals } = data
  const isClosed = inv.status === 'CLOSED'
  const alreadyApplied = inv.correctionsApplied

  const filtered = lines.filter((l) => {
    if (filter === 'all') return true
    if (filter === 'gap') return l.gap !== 0
    if (filter === 'surplus') return l.gap > 0
    if (filter === 'missing') return l.gap < 0
    return true
  })

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={`Comparaison — ${inv.name}`}
        subtitle={
          inv.site?.name
            ? `Stock théorique du site ${inv.site.name} versus ce qui a été compté.`
            : 'Stock théorique versus ce qui a été compté (tous sites confondus).'
        }
      >
        <Button variant="secondary" size="sm" onClick={() => navigate(`/inventory/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'inventaire
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          data-perm="stock:inventories.export"
          title={`Exporter la comparaison (filtre : ${filter})`}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
        {isClosed && !alreadyApplied && totals.productsWithGap > 0 && (
          <Button
            onClick={() => {
              if (
                confirm(
                  `Générer ${totals.productsWithGap} mouvement(s) de correction ? Cette action met à jour les stocks théoriques pour qu'ils correspondent à ce qui a été compté. Elle ne pourra pas être annulée automatiquement.`,
                )
              ) {
                applyMutation.mutate()
              }
            }}
            disabled={applyMutation.isPending}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {applyMutation.isPending
              ? 'Génération…'
              : `Générer ${totals.productsWithGap} mouvement(s)`}
          </Button>
        )}
      </PageHeader>

      {!isClosed && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">L'inventaire n'est pas clôturé</div>
            <p className="mt-0.5 text-[12px]">
              La comparaison reflète l'état actuel mais peut encore changer. Pour générer des mouvements
              de correction, clôturez d'abord l'inventaire.
            </p>
          </div>
        </div>
      )}

      {alreadyApplied && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Corrections déjà appliquées</div>
            <p className="mt-0.5 text-[12px]">
              Les mouvements de correction ont été générés
              {inv.correctionsAppliedAt
                ? ` le ${new Date(inv.correctionsAppliedAt).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}`
                : ''}
              . Les écarts ci-dessous reflètent désormais zéro pour les lignes corrigées.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Produits comptés" value={totals.productsCounted} />
        <KpiCard label="Avec écart" value={totals.productsWithGap} tone="warning" />
        <KpiCard label="Surplus terrain" value={totals.totalSurplus} tone="success" />
        <KpiCard label="Manquant terrain" value={totals.totalMissing} tone="danger" />
      </div>

      <Card>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <FilterPill active={filter === 'gap'} onClick={() => setFilter('gap')}>
              Avec écart ({lines.filter((l) => l.gap !== 0).length})
            </FilterPill>
            <FilterPill active={filter === 'surplus'} onClick={() => setFilter('surplus')}>
              Surplus ({lines.filter((l) => l.gap > 0).length})
            </FilterPill>
            <FilterPill active={filter === 'missing'} onClick={() => setFilter('missing')}>
              Manquants ({lines.filter((l) => l.gap < 0).length})
            </FilterPill>
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              Tout ({lines.length})
            </FilterPill>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2]/30 px-3 py-8 text-center">
              <GitCompareArrows className="mx-auto mb-2 h-6 w-6 text-[--k-muted]" />
              <div className="text-[14px] font-medium text-[--k-text]">Aucune ligne</div>
              <p className="mt-1 text-[12px] text-[--k-muted]">
                {filter === 'gap'
                  ? 'Le compté et le théorique correspondent partout — pas d\'écart.'
                  : 'Aucune ligne ne correspond à ce filtre.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-[13px] table-zebra">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="px-4 py-2 sm:px-6">Produit</th>
                    <th className="px-4 py-2 text-right">Compté</th>
                    <th className="px-4 py-2 text-right">Théorique</th>
                    <th className="px-4 py-2 text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {filtered.map((l) => (
                    <tr key={l.productId} className="row-hover">
                      <td className="px-4 py-2 sm:px-6">
                        <div className="flex items-center gap-2">
                          {l.imageUrl ? (
                            <img
                              src={getFullImageUrl(l.imageUrl)}
                              alt=""
                              className="h-7 w-7 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-[--k-surface-2] text-[--k-muted]">
                              <ClipboardList className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[--k-text]">
                              {l.description || l.reference}
                            </div>
                            <div className="font-mono text-[10px] text-[--k-muted]">
                              {l.reference}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{l.counted}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[--k-muted]">
                        {l.theoretical}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <GapBadge gap={l.gap} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const colors = {
    neutral: 'text-[--k-text]',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-rose-600',
  }
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">{label}</div>
        <div className={`mt-1 text-[20px] font-semibold tabular-nums ${colors[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function GapBadge({ gap }: { gap: number }) {
  if (gap === 0) {
    return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">0</span>
  }
  if (gap > 0) {
    return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 tabular-nums">+{gap}</span>
  }
  return <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 tabular-nums">{gap}</span>
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
        active
          ? 'border-[--k-primary] bg-[--k-primary] text-white'
          : 'border-[--k-border] bg-[--k-surface] text-[--k-muted] hover:text-[--k-text]'
      }`}
    >
      {children}
    </button>
  )
}
