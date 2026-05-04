import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Truck,
  Building2,
  Euro,
  Factory,
  ChevronRight,
} from 'lucide-react'
import { KpiCard } from '../components/KpiCard'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../components/ui/cn'
import api from '../services/api'
import type {
  DashboardStats,
  StockMovement,
  Order,
  LowStockAlert,
  TopProductStock,
  BuildableBorne,
  ApiResponse,
} from '../types'

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

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  IN: 'bg-emerald-50 text-emerald-600',
  OUT: 'bg-red-50 text-red-600',
  TRANSFER: 'bg-blue-50 text-blue-600',
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('')

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard title="Produits" value={formatNumber(stats?.totalProducts || 0)} icon={Package} colorIndex={0} />
        <KpiCard title="Stock total" value={formatNumber(stats?.totalItems || 0)} icon={Building2} colorIndex={2} />
        <KpiCard title="Unités possibles" value={formatNumber(stats?.totalPossibleUnits || 0)} icon={TrendingUp} colorIndex={3} />
        <KpiCard title="Valeur stock" value={formatCurrency(stats?.totalStockValue || 0)} icon={Euro} colorIndex={5} />
        <KpiCard title="Alertes" value={filteredAlerts.length} icon={AlertTriangle} colorIndex={1} />
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
                  <div className="text-xs text-[--k-muted] truncate">{b.name}</div>
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
            </div>
            <span className="text-[11px] font-medium text-amber-600 bg-amber-100/60 rounded-full px-2 py-0.5">
              {filteredAlerts.length}
            </span>
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
              filteredAlerts.slice(0, 5).map((alert) => {
                const threshold = alert.minStock || 10
                const pct = Math.min(Math.round((alert.total / threshold) * 100), 100)
                const level = alert.supplyRisk === 'HIGH' ? 'critical' : 'low'
                return (
                  <div key={alert.id} className="px-4 py-2.5 cursor-pointer hover:bg-[--k-surface-2]/30 transition-colors" onClick={() => navigate(`/products/${alert.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[--k-text] truncate">
                        {alert.reference}
                      </span>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                        level === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      )}>
                        {alert.total}{alert.minStock != null ? `/${alert.minStock}` : ''} ({alert.totalNew} N / {alert.totalUsed} O)
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[--k-muted]">
                        {alert.assembly || 'Sans type'} · {alert.primarySupplier || 'Aucun fournisseur'}
                      </span>
                      <div className="h-1.5 w-20 shrink-0 rounded-full bg-[--k-surface-2] overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', level === 'critical' ? 'bg-red-400' : 'bg-amber-400')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
                Aucune alerte stock
              </p>
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
                <div key={p.reference} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[--k-surface-2] text-[11px] font-semibold text-[--k-muted]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[--k-text] truncate">
                        {p.reference}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[--k-surface-2] text-[--k-muted]">
                        {p.assembly}
                      </span>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-[--k-text]">
                    {formatNumber(p.total)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums bg-emerald-50 text-emerald-600">
                      {p.totalNew} N
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums bg-amber-50 text-amber-600">
                      {p.totalUsed} O
                    </span>
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

        {/* Derniers mouvements */}
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[--k-border] bg-gradient-to-r from-emerald-50/40 to-teal-50/20 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[--k-primary]" />
              <span className="text-lg font-semibold text-[--k-text]">Derniers mouvements</span>
            </div>
            <button
              onClick={() => navigate('/movements')}
              className="text-[11px] font-medium text-[--k-primary] hover:underline"
            >
              Tous
            </button>
          </div>
          {recentMovements && recentMovements.length > 0 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[--k-border] bg-blue-50/30 text-[--k-muted]">
                  <th className="px-4 py-2 text-left text-xs font-medium">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Produit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Qté</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.slice(0, 5).map((m) => (
                  <tr key={m.id} className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors">
                    <td className="px-4 py-2">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        MOVEMENT_TYPE_COLORS[m.type] || 'bg-gray-50 text-gray-600'
                      )}>
                        {MOVEMENT_TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-[--k-text]">{m.product?.reference}</td>
                    <td className="px-4 py-2 tabular-nums">{m.quantity}</td>
                    <td className="px-4 py-2 text-[--k-muted] tabular-nums">
                      {formatDate(m.movementDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
              Aucun mouvement récent
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
