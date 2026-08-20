import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plus, X, AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import api from '../../services/api'
import RichTextEditor from '../ui/RichTextEditor'
import type { Order, OrderItem, Site, ApiResponse, AnomalyDecision } from '../../types'
import Spinner from '../ui/Spinner'

interface ReceiveItemFormData {
  receivedDate: string
  receivedQty: number
  condition: 'NEW' | 'USED'
  siteId: string
  comment?: string
}

interface AnomalyDraft {
  key: string
  quantity: number
  decision: AnomalyDecision
  comment: string
}

interface ReceiveOrderFormProps {
  orderId: string
  itemId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function ReceiveOrderForm({ orderId, itemId, onSuccess, onCancel }: ReceiveOrderFormProps) {
  const queryClient = useQueryClient()
  const [anomalies, setAnomalies] = useState<AnomalyDraft[]>([])

  const { data: order, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${orderId}`)
      return res.data?.data
    },
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites')
      return res.data?.data
    },
  })

  const storageSites = sites?.filter((s) => s.type === 'STORAGE' && s.isActive) || []
  const item = order?.items?.find((i: OrderItem) => i.id === itemId)

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<ReceiveItemFormData>({
    defaultValues: {
      receivedDate: new Date().toISOString().split('T')[0],
      receivedQty: item?.quantity || 1,
      condition: 'NEW',
      siteId: order?.destinationSiteId || '',
      comment: '',
    },
  })

  const receivedQty = watch('receivedQty')

  const acceptedAnomalyQty = anomalies
    .filter((a) => a.decision === 'ACCEPTED')
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0)
  const refusedAnomalyQty = anomalies
    .filter((a) => a.decision === 'REFUSED')
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0)
  const hasIncompleteAnomaly = anomalies.some((a) => !a.comment.trim() || a.quantity < 1)
  const acceptedOverflow = receivedQty > 0 && acceptedAnomalyQty > Number(receivedQty)

  const receiveMutation = useMutation({
    mutationFn: async (data: ReceiveItemFormData) => {
      const payload: any = {
        receivedQty: Number(data.receivedQty),
        receivedDate: new Date(data.receivedDate).toISOString(),
        condition: data.condition,
        siteId: data.siteId || undefined,
        comment: data.comment || undefined,
      }
      if (anomalies.length > 0) {
        payload.anomalies = anomalies.map((a) => ({
          quantity: Number(a.quantity),
          decision: a.decision,
          comment: a.comment.trim(),
        }))
      }
      const res = await api.post(`/orders/${orderId}/items/${itemId}/receive`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
      queryClient.invalidateQueries({ queryKey: ['supplier'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-anomalies'] })
      queryClient.invalidateQueries({ queryKey: ['stocks'] })
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] })
      onSuccess()
    },
  })

  const onSubmit = (data: ReceiveItemFormData) => {
    if (hasIncompleteAnomaly || acceptedOverflow) return
    receiveMutation.mutate(data)
  }

  if (isLoadingOrder) {
    return (
      <Spinner size="md" label="Chargement..." className="py-8" />
    )
  }

  if (!order || !item) {
    return <div className="py-8 text-center text-[--k-danger]">Article introuvable</div>
  }

  const addAnomaly = () => {
    setAnomalies((prev) => [
      ...prev,
      {
        key: `a-${Date.now()}-${Math.random()}`,
        quantity: 1,
        decision: 'ACCEPTED',
        comment: '',
      },
    ])
  }

  const updateAnomaly = (key: string, patch: Partial<AnomalyDraft>) => {
    setAnomalies((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)))
  }

  const removeAnomaly = (key: string) => {
    setAnomalies((prev) => prev.filter((a) => a.key !== key))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2 text-[13px]">Détails de l'article</h4>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <span className="text-blue-700">Produit :</span>
          <span className="font-medium text-blue-900 inline-flex items-center gap-1.5">
            {item.product?.description || item.product?.reference || item.productId}
            {item.productId && (
              <a
                href={`/products/${item.productId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:text-blue-900"
                title="Ouvrir la fiche produit dans un nouvel onglet"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </span>
          <span className="text-blue-700">Référence :</span>
          <span className="font-medium text-blue-900">{item.product?.reference}</span>
          <span className="text-blue-700">Fournisseur :</span>
          <span className="font-medium text-blue-900">{order.supplier.name}</span>
          <span className="text-blue-700">Quantité commandée :</span>
          <span className="font-medium text-blue-900">{item.quantity}</span>
          {item.unitPrice && (
            <>
              <span className="text-blue-700">Prix unitaire :</span>
              <span className="font-medium text-blue-900">{Number(item.unitPrice).toFixed(2)} €</span>
            </>
          )}
        </div>
      </div>

      <Input
        id="receivedDate"
        type="date"
        label="Date de réception *"
        error={errors.receivedDate?.message}
        {...register('receivedDate', { required: 'Date requise' })}
      />

      <Select
        id="siteId"
        label="Site de destination *"
        error={errors.siteId?.message}
        {...register('siteId', { required: Number(receivedQty) > 0 ? 'Site requis' : false })}
      >
        <option value="">Sélectionner un site</option>
        {storageSites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Input
        id="receivedQty"
        type="number"
        label="Quantité acceptée en stock *"
        min={0}
        error={errors.receivedQty?.message}
        {...register('receivedQty', {
          required: 'Quantité requise',
          min: { value: 0, message: 'La quantité ne peut pas être négative' },
        })}
      />
      <p className="text-xs text-[--k-muted] -mt-2">
        C'est le nombre d'unités qui entrent réellement en stock (sans les unités refusées).
      </p>

      {receivedQty != null && Number(receivedQty) !== item.quantity && Number(receivedQty) > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700 border border-amber-200">
          <strong>Attention :</strong> La quantité reçue ({receivedQty}) diffère de la quantité commandée
          ({item.quantity}).
        </div>
      )}

      <Select id="condition" label="État du produit *" error={errors.condition?.message} {...register('condition')}>
        <option value="NEW">Neuf</option>
        <option value="USED">Occasion</option>
      </Select>

      {/* Anomalies section */}
      <div className="rounded-xl border border-[--k-border] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-[13px] font-medium text-[--k-text]">
              Anomalies à la réception
            </span>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={addAnomaly}>
            <Plus className="mr-1 h-4 w-4" />
            Signaler
          </Button>
        </div>
        <p className="text-xs text-[--k-muted]">
          Signalez les unités endommagées (rayures, casse…). « Acceptée » : on garde le produit (avec
          un drapeau sur sa fiche). « Refusée » : le produit n'entre pas en stock mais reste tracé pour
          la fiabilité fournisseur.
        </p>

        {anomalies.length === 0 ? (
          <p className="text-center text-xs italic text-[--k-muted] py-2">
            Aucune anomalie signalée.
          </p>
        ) : (
          <div className="space-y-2">
            {anomalies.map((a) => (
              <div
                key={a.key}
                className="grid grid-cols-1 sm:grid-cols-[80px_140px_1fr_auto] gap-2 items-start rounded-lg bg-[--k-surface-2]/60 p-2"
              >
                <Input
                  type="number"
                  min={1}
                  value={a.quantity}
                  onChange={(e) =>
                    updateAnomaly(a.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  placeholder="Qté"
                />
                <Select
                  value={a.decision}
                  onChange={(e) =>
                    updateAnomaly(a.key, { decision: e.target.value as AnomalyDecision })
                  }
                >
                  <option value="ACCEPTED">Acceptée</option>
                  <option value="REFUSED">Refusée</option>
                </Select>
                <Input
                  value={a.comment}
                  onChange={(e) => updateAnomaly(a.key, { comment: e.target.value })}
                  placeholder="Commentaire obligatoire (ex : rayure, casse…)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAnomaly(a.key)}
                  className="text-red-600 hover:bg-red-50"
                  title="Retirer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="text-[11px] text-[--k-muted] pt-1 space-y-0.5">
              {acceptedAnomalyQty > 0 && (
                <div>
                  • {acceptedAnomalyQty} unité(s) acceptée(s) avec anomalie (entrent en stock avec
                  drapeau)
                </div>
              )}
              {refusedAnomalyQty > 0 && (
                <div>• {refusedAnomalyQty} unité(s) refusée(s) (n'entrent pas en stock)</div>
              )}
            </div>
            {hasIncompleteAnomaly && (
              <p className="text-xs text-red-600">
                Chaque anomalie doit avoir une quantité ≥ 1 et un commentaire.
              </p>
            )}
            {acceptedOverflow && (
              <p className="text-xs text-red-600">
                Les anomalies acceptées ({acceptedAnomalyQty}) dépassent la quantité reçue ({receivedQty}
                ).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-[13px] font-medium text-[--k-text]">
          Commentaire général (optionnel)
        </label>
        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <RichTextEditor
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Commentaire optionnel..."
              fetchMentions={() => []}
            />
          )}
        />
      </div>

      {receiveMutation.error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700 border border-red-200">
          {(receiveMutation.error as any)?.response?.data?.error ||
            'Erreur lors de la réception'}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          isLoading={receiveMutation.isPending}
          disabled={hasIncompleteAnomaly || acceptedOverflow}
        >
          Confirmer la réception
        </Button>
      </div>
    </form>
  )
}
