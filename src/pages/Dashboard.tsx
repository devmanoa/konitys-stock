import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  Building2,
  Euro,
  Factory,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
} from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import ProductImageLightbox from '../components/ProductImageLightbox'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../components/ui/cn'
import api from '../services/api'
import { formatStockBreakdown } from '../utils/stockFormat'
import { getOperatorInitials, getOperatorColor } from '../utils/operatorAvatar'
import type {
  DashboardStats,
  StockMovement,
  Order,
  LowStockAlert,
  TopProductStock,
  BuildableBorne,
  ApiResponse,
} from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

const ORDER_STATUT_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  SHIPPED: 'bg-indigo-50 text-indigo-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

const ORDER_STATUT_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  SHIPPED: 'Expédiée',
  COMPLETED: 'Reçue',
  CANCELLED: 'Annulée',
}



export default function Dashboard() {
  const navigate = useNavigate()
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('')
  // Lightbox state shared by every product thumbnail on the dashboard
  const [lightboxImage, setLightboxImage] = useState<
    { url: string | null; alt: string; downloadName: string } | null
  >(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats')
      return res.data?.data
    },
  })

  const { data: recentMovements } = useQuery({
    queryKey: ['recent-movements'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StockMovement[] }>(
        '/dashboard/recent-movements'
      )
      return res.data?.data
    },
  })

  const { data: pendingOrders } = useQuery({
    queryKey: ['pending-orders'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Order[] }>('/dashboard/pending-orders')
      return res.data?.data
    },
  })

  const { data: lowStockAlerts } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: LowStockAlert[] }>(
        '/dashboard/low-stock-alerts?threshold=10'
      )
      return res.data?.data
    },
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TopProductStock[] }>(
        '/dashboard/top-products?limit=6'
      )
      return res.data?.data
    },
  })

  const { data: buildableBornes } = useQuery({
    queryKey: ['buildable-bornes'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BuildableBorne[]>>('/assembly-types/buildable')
      return res.data?.data || []
    },
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR')
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value)
  }

  // Onglets dynamiques par type de borne (uniquement ceux qui ont des alertes)
  const availableAlertTypes = useMemo(() => {
    const map = new Map<string, string>()
    let hasUnassigned = false
    for (const a of lowStockAlerts || []) {
      if (a.assemblyType?.id) map.set(a.assemblyType.id, a.assemblyType.name)
      else hasUnassigned = true
    }
    const types = Array.from(map.entries()).map(([id, name]) => ({ id, name }))
    types.sort((a, b) => a.name.localeCompare(b.name))
    return { types, hasUnassigned }
  }, [lowStockAlerts])

  const filteredAlerts = useMemo(() => {
    if (!lowStockAlerts) return []
    if (!alertTypeFilter) return lowStockAlerts
    if (alertTypeFilter === '__none__') return lowStockAlerts.filter((a) => !a.assemblyType?.id)
    return lowStockAlerts.filter((a) => a.assemblyType?.id === alertTypeFilter)
  }, [lowStockAlerts, alertTypeFilter])

  if (statsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[--k-primary] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tableau de bord" subtitle="Stock Manager — Vue d'ensemble" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Produits" value={formatNumber(stats?.totalProducts || 0)} icon={Package} colorIndex={0} />
        <KpiCard title="Stock total" value={formatNumber(stats?.totalItems || 0)} icon={Building2} colorIndex={2} />
        <KpiCard title="Valeur stock" value={formatCurrency(stats?.totalStockValue || 0)} icon={Euro} colorIndex={5} />
        <KpiCard
          title="Alertes"
          value={filteredAlerts.length}
          icon={AlertTriangle}
          colorIndex={1}
          onClick={() => navigate('/stocks/alerts')}
        />
      </div>

      {/* Buildable bornes */}
      {buildableBornes && buildableBornes.length > 0 && (
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r from-amber-50/60 to-orange-50/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-amber-500" />
              <span className="text-lg font-semibold text-[--k-text]">Bornes constructibles</span>
            </div>
            <button
              onClick={() => navigate('/buildable-bornes')}
              className="flex items-center gap-1 text-[11px] font-medium text-[--k-primary] hover:underline"
            >
              Voir le détail <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {buildableBornes.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigate('/buildable-bornes')}
                  className="text-left rounded-xl border border-[--k-border] bg-white p-3 transition hover:border-[--k-primary] hover:shadow-sm"
                >
                  <div className="text-sm font-semibold text-[--k-text] truncate">{b.name}</div>
                  <div
                    className={cn(
                      'text-2xl font-bold',
                      b.maxBuildable > 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {b.maxBuildable}
                  </div>
                  <div className="text-xs text-[--k-muted]">constructibles</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content: Commandes + Alertes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Commandes en cours */}
        <div className="lg:col-span-2 rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r from-blue-50/60 to-indigo-50/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[--k-primary]" />
              <span className="text-lg font-semibold text-[--k-text]">Commandes en cours</span>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-[11px] font-medium text-[--k-primary] hover:underline"
            >
              Toutes les commandes
            </button>
          </div>
          {pendingOrders && pendingOrders.length > 0 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[--k-border] bg-blue-50/30 text-[--k-muted]">
                  <th className="px-4 py-2 text-left text-xs font-medium">Réf.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Fournisseur</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Articles</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Statut</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.slice(0, 5).map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-2 font-medium tabular-nums text-[--k-primary]">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-2 text-[--k-text]">{order.supplier?.name}</td>
                    <td className="px-4 py-2 tabular-nums">{order.items?.length || 0}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        ORDER_STATUT_COLORS[order.status] || 'bg-gray-50 text-gray-600'
                      )}>
                        {ORDER_STATUT_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[--k-muted] tabular-nums">
                      {formatDate(order.orderDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
              Aucune commande en cours
            </p>
          )}
        </div>

        {/* Alertes stock */}
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
          <div className="flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r from-amber-50/50 to-orange-50/30 px-4 py-2.5 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-lg font-semibold text-[--k-text]">Alertes stock</span>
              <span className="text-[11px] font-medium text-amber-600 bg-amber-100/60 rounded-full px-2 py-0.5">
                {filteredAlerts.length}
              </span>
            </div>
            <button
              onClick={() => navigate('/stocks/alerts')}
              className="text-[11px] font-medium text-[--k-primary] hover:underline"
            >
              Tous
            </button>
          </div>
          {(availableAlertTypes.types.length > 0 || availableAlertTypes.hasUnassigned) && (
            <div className="flex items-center gap-1 border-b border-[--k-border] px-2 overflow-x-auto">
              {[
                { value: '', label: 'Toutes' },
                ...availableAlertTypes.types.map((t) => ({ value: t.id, label: t.name })),
                ...(availableAlertTypes.hasUnassigned ? [{ value: '__none__', label: 'Sans type' }] : []),
              ].map((tab) => {
                const isActive = alertTypeFilter === tab.value
                return (
                  <button
                    key={tab.value || 'all'}
                    type="button"
                    onClick={() => setAlertTypeFilter(tab.value)}
                    className={cn(
                      'relative px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors',
                      isActive ? 'text-[--k-primary]' : 'text-[--k-muted] hover:text-[--k-text]'
                    )}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[--k-primary]" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <div className="divide-y divide-[--k-border]">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.slice(0, 10).map((alert) => {
                const threshold = alert.minStock || 10
                const pct = Math.min(Math.round((alert.total / threshold) * 100), 100)
                const level = alert.supplyRisk === 'HIGH' ? 'critical' : 'low'
                const typeName = alert.assemblyType?.name || alert.assembly
                return (
                  <div key={alert.id} className="px-4 py-2.5 cursor-pointer hover:bg-[--k-surface-2]/30 transition-colors" onClick={() => navigate(`/products/${alert.id}`)}>
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setLightboxImage({
                            url: alert.imageUrl || null,
                            alt: alert.description || alert.reference,
                            downloadName: alert.reference,
                          })
                        }}
                        className="shrink-0"
                        title="Voir l'image en grand"
                      >
                        <img
                          src={getFullImageUrl(alert.imageUrl)}
                          alt=""
                          className="h-8 w-8 rounded object-cover bg-[--k-surface-2] border border-[--k-border] hover:ring-2 hover:ring-[--k-primary] transition"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE }}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {level === 'critical' && (
                            <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-red-600" />
                          )}
                          <div className="text-[12px] font-medium text-[--k-text] truncate">
                            {alert.description || alert.reference}
                          </div>
                        </div>
                        {alert.description && (
                          <div className="text-[10px] text-[--k-muted] font-mono truncate">
                            {alert.reference}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        level === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      )}>
                        {formatStockBreakdown(alert.totalNew, alert.totalUsed)}{alert.minStock != null ? ` / ${alert.minStock}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[--k-muted] truncate">
                        {typeName && (
                          <span className="inline-block rounded-full bg-[--k-surface-2] px-1.5 py-0.5 text-[10px] font-medium text-[--k-text] mr-1.5">
                            {typeName}
                          </span>
                        )}
                        {alert.primarySupplier || 'Aucun fournisseur'}
                      </span>
                      {pct > 0 && (
                        <div className="h-1.5 w-20 shrink-0 rounded-full bg-[--k-surface-2] overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', level === 'critical' ? 'bg-red-400' : 'bg-amber-400')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
                Aucune alerte stock
              </p>
            )}
            {filteredAlerts.length > 10 && (
              <button
                onClick={() => navigate('/stocks/alerts')}
                className="w-full px-4 py-2 text-center text-[11px] font-medium text-[--k-primary] hover:bg-[--k-surface-2]/30 transition-colors"
              >
                + {filteredAlerts.length - 10} autres alertes — voir tout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Top produits + Derniers mouvements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Top produits */}
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
          <div className="flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r from-indigo-50/50 to-blue-50/30 px-4 py-2.5 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[--k-primary]" />
              <span className="text-lg font-semibold text-[--k-text]">Top produits</span>
            </div>
            <span className="text-[11px] text-[--k-muted]">Par volume de stock</span>
          </div>
          <div className="divide-y divide-[--k-border]">
            {topProducts && topProducts.length > 0 ? (
              topProducts.map((p, i) => (
                <div key={p.id || p.reference} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[--k-surface-2] text-[11px] font-semibold text-[--k-muted]">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        url: p.imageUrl || null,
                        alt: p.description || p.reference,
                        downloadName: p.reference,
                      })
                    }
                    className="shrink-0"
                    title="Voir l'image en grand"
                  >
                    <img
                      src={getFullImageUrl(p.imageUrl)}
                      alt=""
                      className="h-8 w-8 rounded object-cover bg-[--k-surface-2] border border-[--k-border] hover:ring-2 hover:ring-[--k-primary] transition"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE
                      }}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {p.id ? (
                        <RouterLink
                          to={`/products/${p.id}`}
                          className="text-[12px] font-medium text-[--k-primary] hover:underline truncate"
                        >
                          {p.description || p.reference}
                        </RouterLink>
                      ) : (
                        <span className="text-[12px] font-medium text-[--k-text] truncate">{p.description || p.reference}</span>
                      )}
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[--k-surface-2] text-[--k-muted]">
                        {p.assembly}
                      </span>
                    </div>
                    {p.description && (
                      <div className="text-[10px] text-[--k-muted] font-mono truncate mt-0.5">
                        {p.reference}
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-[--k-text]">
                    {formatNumber(p.total)}
                  </span>
                  <div className="flex items-center gap-1">
                    {p.totalNew > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums bg-emerald-50 text-emerald-600">
                        {p.totalNew} {p.totalNew > 1 ? 'neufs' : 'neuf'}
                      </span>
                    )}
                    {p.totalUsed > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums bg-amber-50 text-amber-600">
                        {p.totalUsed} occas
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
                Aucun produit en stock
              </p>
            )}
          </div>
        </div>

        {/* Dernières entrées / sorties / transferts — 3 compact blocks
            (replace the single mixed list with one block per movement type) */}
        <div className="space-y-4">
          <RecentMovementsBlock
            title="Dernières entrées"
            type="IN"
            movements={recentMovements || []}
            navigate={navigate}
            formatDate={formatDate}
            onImageClick={(url, alt, downloadName) =>
              setLightboxImage({ url: url || null, alt, downloadName })
            }
          />
          <RecentMovementsBlock
            title="Dernières sorties"
            type="OUT"
            movements={recentMovements || []}
            navigate={navigate}
            formatDate={formatDate}
            onImageClick={(url, alt, downloadName) =>
              setLightboxImage({ url: url || null, alt, downloadName })
            }
          />
          <RecentMovementsBlock
            title="Derniers transferts"
            type="TRANSFER"
            movements={recentMovements || []}
            navigate={navigate}
            formatDate={formatDate}
            onImageClick={(url, alt, downloadName) =>
              setLightboxImage({ url: url || null, alt, downloadName })
            }
          />
        </div>
      </div>

      {/* Shared image lightbox for every product thumbnail on the dashboard */}
      <ProductImageLightbox
        imageUrl={lightboxImage?.url}
        alt={lightboxImage?.alt || ''}
        downloadName={lightboxImage?.downloadName}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  )
}

// Compact "latest movements" block scoped to a single movement type.
function RecentMovementsBlock({
  title,
  type,
  movements,
  navigate,
  formatDate,
  onImageClick,
}: {
  title: string
  type: 'IN' | 'OUT' | 'TRANSFER'
  movements: StockMovement[]
  navigate: (path: string) => void
  formatDate: (d: string) => string
  onImageClick: (url: string | null | undefined, alt: string, downloadName: string) => void
}) {
  const filtered = movements.filter((m) => m.type === type).slice(0, 5)
  const headerGradient =
    type === 'IN'
      ? 'from-emerald-50/40 to-teal-50/20'
      : type === 'OUT'
        ? 'from-red-50/40 to-orange-50/20'
        : 'from-blue-50/40 to-indigo-50/20'
  const Icon = type === 'IN' ? ArrowDownCircle : type === 'OUT' ? ArrowUpCircle : ArrowLeftRight
  const iconColor =
    type === 'IN' ? 'text-emerald-600' : type === 'OUT' ? 'text-red-600' : 'text-blue-600'

  return (
    <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r px-4 py-2.5',
          headerGradient,
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} />
          <span className="text-sm font-semibold text-[--k-text]">{title}</span>
          <span className="rounded-full bg-[--k-surface-2] px-1.5 py-0.5 text-[10px] font-medium text-[--k-muted]">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => navigate(`/movements?type=${type}`)}
          className="text-[11px] font-medium text-[--k-primary] hover:underline"
        >
          Tous
        </button>
      </div>
      {filtered.length > 0 ? (
        <div className="divide-y divide-[--k-border]">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[--k-surface-2]/30 transition-colors"
            >
              <span className="text-[13px] font-semibold tabular-nums text-[--k-text] w-8 text-right shrink-0">
                {m.quantity}
              </span>
              {m.product && (
                <button
                  type="button"
                  onClick={() =>
                    onImageClick(
                      m.product?.imageUrl,
                      m.product?.description || m.product?.reference || '',
                      m.product?.reference || '',
                    )
                  }
                  className="shrink-0"
                  title="Voir l'image en grand"
                >
                  <img
                    src={getFullImageUrl(m.product.imageUrl)}
                    alt=""
                    className="h-7 w-7 rounded object-cover bg-[--k-surface-2] border border-[--k-border] hover:ring-2 hover:ring-[--k-primary] transition"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE
                    }}
                  />
                </button>
              )}
              <div className="min-w-0 flex-1">
                {m.product ? (
                  <RouterLink
                    to={`/products/${m.productId}`}
                    className="block hover:underline"
                  >
                    <div className="font-medium text-[12px] text-[--k-primary] truncate">
                      {m.product.description || m.product.reference}
                    </div>
                    {m.product.description && (
                      <div className="text-[10px] text-[--k-muted] font-mono truncate">
                        {m.product.reference}
                      </div>
                    )}
                  </RouterLink>
                ) : (
                  '—'
                )}
              </div>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold flex-shrink-0',
                  getOperatorColor(m.operator),
                )}
                title={m.operator || 'Inconnu'}
              >
                {getOperatorInitials(m.operator)}
              </span>
              <span className="text-[11px] text-[--k-muted] tabular-nums whitespace-nowrap">
                {formatDate(m.movementDate)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-center text-[12px] text-[--k-muted] italic">
          Aucun mouvement
        </p>
      )}
    </div>
  )
}
