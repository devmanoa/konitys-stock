import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertOctagon,
  ArrowLeft,
  ArrowUpDown,
  Search,
  Filter,
} from 'lucide-react'
import Button from '../components/ui/Button'
import SearchSelect from '../components/ui/SearchSelect'
import { PageHeader } from '../components/PageHeader'
import { KpiCard } from '../components/KpiCard'
import { cn } from '../components/ui/cn'
import api from '../services/api'
import type { ApiResponse, LowStockAlert } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

type SortField = 'reference' | 'total' | 'minStock' | 'fill'
type SortOrder = 'asc' | 'desc'

export default function StockAlerts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<'' | 'critical' | 'low'>('')
  const [hasSupplierFilter, setHasSupplierFilter] = useState<'' | 'yes' | 'no'>('')
  const [sortField, setSortField] = useState<SortField>('fill')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LowStockAlert[]>>(
        '/dashboard/low-stock-alerts?threshold=10',
      )
      return res.data?.data || []
    },
  })

  // Available type filters from alerts data
  const availableTypes = useMemo(() => {
    const map = new Map<string, string>()
    let hasUnassigned = false
    for (const a of alerts || []) {
      if (a.assemblyType?.id) map.set(a.assemblyType.id, a.assemblyType.name)
      else hasUnassigned = true
    }
    const types = Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { types, hasUnassigned }
  }, [alerts])

  const filteredAlerts = useMemo(() => {
    let result = alerts || []
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.reference.toLowerCase().includes(s) ||
          a.description?.toLowerCase().includes(s) ||
          a.primarySupplier?.toLowerCase().includes(s),
      )
    }
    if (typeFilter === '__none__') {
      result = result.filter((a) => !a.assemblyType?.id)
    } else if (typeFilter) {
      result = result.filter((a) => a.assemblyType?.id === typeFilter)
    }
    if (levelFilter === 'critical') {
      result = result.filter((a) => a.supplyRisk === 'HIGH')
    } else if (levelFilter === 'low') {
      result = result.filter((a) => a.supplyRisk !== 'HIGH')
    }
    if (hasSupplierFilter === 'yes') {
      result = result.filter((a) => !!a.primarySupplier)
    } else if (hasSupplierFilter === 'no') {
      result = result.filter((a) => !a.primarySupplier)
    }
    // Sort
    const fillOf = (a: LowStockAlert) => {
      const threshold = a.minStock || 10
      return threshold > 0 ? a.total / threshold : 0
    }
    result = [...result].sort((x, y) => {
      let cmp = 0
      switch (sortField) {
        case 'reference':
          cmp = x.reference.localeCompare(y.reference)
          break
        case 'total':
          cmp = x.total - y.total
          break
        case 'minStock':
          cmp = (x.minStock ?? 0) - (y.minStock ?? 0)
          break
        case 'fill':
          cmp = fillOf(x) - fillOf(y)
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return result
  }, [alerts, search, typeFilter, levelFilter, hasSupplierFilter, sortField, sortOrder])

  const counts = useMemo(() => {
    const total = (alerts || []).length
    const critical = (alerts || []).filter((a) => a.supplyRisk === 'HIGH').length
    return { total, critical, low: total - critical }
  }, [alerts])

  const hasFilters = search || typeFilter || levelFilter || hasSupplierFilter
  const resetFilters = () => {
    setSearch('')
    setTypeFilter('')
    setLevelFilter('')
    setHasSupplierFilter('')
  }

  const handleSort = (f: SortField) => {
    if (sortField === f) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(f)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (f: SortField) => {
    if (sortField !== f) return <ArrowUpDown className="h-3 w-3 opacity-50" />
    return <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
  }

  const renderFill = (a: LowStockAlert) => {
    const threshold = a.minStock || 10
    const pct = threshold > 0 ? Math.min(Math.round((a.total / threshold) * 100), 100) : 0
    const level = a.supplyRisk === 'HIGH' ? 'critical' : 'low'
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 shrink-0 rounded-full bg-[--k-surface-2] overflow-hidden">
          {pct > 0 && (
            <div
              className={cn(
                'h-full rounded-full',
                level === 'critical' ? 'bg-red-400' : 'bg-amber-400',
              )}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        <span className="text-xs text-[--k-muted] tabular-nums">{pct}%</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Alertes stock" subtitle="Produits nécessitant un réapprovisionnement">
        <Button variant="secondary" onClick={() => navigate('/stocks')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Vue stock
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          title="Total alertes"
          value={counts.total}
          icon={AlertTriangle}
          colorIndex={1}
        />
        <KpiCard
          title="Critiques"
          value={counts.critical}
          icon={AlertOctagon}
          colorIndex={1}
        />
        <KpiCard
          title="Sous le seuil"
          value={counts.low}
          icon={AlertTriangle}
          colorIndex={2}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[140px] sm:w-[352px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="Rechercher (réf., description, fournisseur)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          <SearchSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              ...availableTypes.types.map((t) => ({ value: t.id, label: t.name })),
              ...(availableTypes.hasUnassigned
                ? [{ value: '__none__', label: 'Sans type' }]
                : []),
            ]}
            placeholder="Type de borne"
            className="min-w-[160px] sm:w-[240px]"
          />
          <SearchSelect
            value={levelFilter}
            onChange={(v) => setLevelFilter(v as '' | 'critical' | 'low')}
            options={[
              { value: 'critical', label: 'Critique (HIGH)' },
              { value: 'low', label: 'Sous le seuil' },
            ]}
            placeholder="Niveau"
            className="min-w-[160px] sm:w-[200px]"
          />
          <SearchSelect
            value={hasSupplierFilter}
            onChange={(v) => setHasSupplierFilter(v as '' | 'yes' | 'no')}
            options={[
              { value: 'yes', label: 'Avec fournisseur' },
              { value: 'no', label: 'Sans fournisseur' },
            ]}
            placeholder="Fournisseur"
            className="min-w-[160px] sm:w-[200px]"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="whitespace-nowrap">
            <Filter className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="text-lg font-semibold text-[--k-text]">Produits en alerte</div>
          <div className="text-xs text-[--k-muted]">
            {filteredAlerts.length} sur {counts.total}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-[--k-muted]">
            {(alerts || []).length === 0
              ? 'Aucune alerte stock — tout va bien.'
              : 'Aucune alerte ne correspond aux filtres.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] table-zebra">
              <thead className="bg-[--k-surface-2]/50">
                <tr className="text-left text-xs font-medium uppercase text-[--k-muted]">
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[--k-text]"
                      onClick={() => handleSort('reference')}
                    >
                      Produit {getSortIcon('reference')}
                    </button>
                  </th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[--k-text]"
                      onClick={() => handleSort('total')}
                    >
                      Stock {getSortIcon('total')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[--k-text]"
                      onClick={() => handleSort('minStock')}
                    >
                      Seuil {getSortIcon('minStock')}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[--k-text]"
                      onClick={() => handleSort('fill')}
                    >
                      Remplissage {getSortIcon('fill')}
                    </button>
                  </th>
                  <th className="px-3 py-2">Fournisseur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--k-border]">
                {filteredAlerts.map((a) => {
                  const level = a.supplyRisk === 'HIGH' ? 'critical' : 'low'
                  return (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/products/${a.id}`)}
                      className="cursor-pointer row-hover transition-colors"
                    >
                      <td className="px-3 py-2 w-12">
                        <img
                          src={getFullImageUrl(a.imageUrl)}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded object-cover bg-[--k-surface-2] border border-[--k-border]"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {level === 'critical' && (
                            <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-red-600" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-[--k-text] truncate">
                              {a.description || a.reference}
                            </div>
                            {a.description && (
                              <div className="text-[11px] text-[--k-muted] font-mono truncate">
                                {a.reference}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[--k-muted]">
                        {a.assemblyType?.name || (
                          <span className="italic text-xs">Sans type</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                            level === 'critical'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-600',
                          )}
                        >
                          {a.total}
                          {a.totalNew + a.totalUsed > 0 && a.totalUsed > 0 && (
                            <span className="ml-1 text-[10px] font-normal opacity-70">
                              ({a.totalNew}N / {a.totalUsed}O)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[--k-muted] tabular-nums">
                        {a.minStock ?? <span className="italic text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2">{renderFill(a)}</td>
                      <td className="px-3 py-2 text-[--k-muted]">
                        {a.primarySupplier || (
                          <span className="italic text-xs text-amber-600">
                            Aucun fournisseur
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
