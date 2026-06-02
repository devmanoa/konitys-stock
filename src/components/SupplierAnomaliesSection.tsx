import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, X as XIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import OperatorAvatar from './OperatorAvatar'
import api from '../services/api'
import type { ApiResponse, ReceptionAnomalyWithContext } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg'

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

interface Props {
  supplierId: string
}

export default function SupplierAnomaliesSection({ supplierId }: Props) {
  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['supplier-anomalies', supplierId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReceptionAnomalyWithContext[]>>(
        `/suppliers/${supplierId}/reception-anomalies`,
      )
      return res.data?.data || []
    },
  })

  if (isLoading) {
    return null
  }

  const list = anomalies || []
  if (list.length === 0) {
    // Hide the section entirely when there's no anomaly to report — keeps the
    // supplier detail page clean for the common case.
    return null
  }

  const acceptedCount = list.filter((a) => a.decision === 'ACCEPTED').length
  const refusedCount = list.filter((a) => a.decision === 'REFUSED').length
  const totalUnits = list.reduce((s, a) => s + a.quantity, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Anomalies de réception ({list.length})
        </CardTitle>
        <div className="text-xs text-[--k-muted]">
          {acceptedCount} acceptée(s) · {refusedCount} refusée(s) · {totalUnits} unité(s) au total
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Commande</th>
                <th className="px-2 py-2">Produit</th>
                <th className="px-2 py-2 text-center">Qté</th>
                <th className="px-2 py-2">Décision</th>
                <th className="px-2 py-2">Commentaire</th>
                <th className="px-2 py-2">Signalée par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--k-border]">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-[--k-surface-2]/30 transition-colors">
                  <td className="px-2 py-2 text-[--k-muted] tabular-nums whitespace-nowrap">
                    {new Date(a.reportedAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      to={`/orders/${a.orderItem.order.id}`}
                      className="text-[--k-primary] hover:underline font-mono text-[12px]"
                    >
                      {a.orderItem.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={getFullImageUrl(a.orderItem.product.imageUrl)}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded object-cover bg-[--k-surface-2] border border-[--k-border]"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE
                        }}
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/products/${a.orderItem.product.id}`}
                          className="block font-medium text-[--k-primary] hover:underline truncate"
                        >
                          {a.orderItem.product.description || a.orderItem.product.reference}
                        </Link>
                        {a.orderItem.product.description && (
                          <div className="text-[11px] font-mono text-[--k-muted] truncate">
                            {a.orderItem.product.reference}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">{a.quantity}</td>
                  <td className="px-2 py-2">
                    {a.decision === 'ACCEPTED' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <Check className="h-3 w-3" />
                        Acceptée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        <XIcon className="h-3 w-3" />
                        Refusée
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-[--k-text] max-w-[280px]">
                    <span className="line-clamp-2" title={a.comment}>
                      {a.comment}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <OperatorAvatar name={a.reportedByName} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
