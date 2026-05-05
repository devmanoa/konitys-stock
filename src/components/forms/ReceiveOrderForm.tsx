import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import api from '../../services/api'
import type { Order, OrderItem, Site, ApiResponse } from '../../types'

interface ReceiveItemFormData {
  receivedDate: string
  receivedQty: number
  condition: 'NEW' | 'USED'
  siteId: string
  comment?: string
}

interface ReceiveOrderFormProps {
  orderId: string
  itemId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function ReceiveOrderForm({ orderId, itemId, onSuccess, onCancel }: ReceiveOrderFormProps) {
  const queryClient = useQueryClient()

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

  const storageSites = sites?.filter(s => s.type === 'STORAGE' && s.isActive) || []
  const item = order?.items?.find((i: OrderItem) => i.id === itemId)

  const {
    register,
    handleSubmit,
    watch,
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
  const condition = watch('condition')
  const siteId = watch('siteId')

  const selectedSite = storageSites.find(s => s.id === siteId)

  const receiveMutation = useMutation({
    mutationFn: async (data: ReceiveItemFormData) => {
      const payload = {
        receivedQty: Number(data.receivedQty),
        receivedDate: new Date(data.receivedDate).toISOString(),
        condition: data.condition,
        siteId: data.siteId || undefined,
        comment: data.comment || undefined,
      }
      const res = await api.post(`/orders/${orderId}/items/${itemId}/receive`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
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
    receiveMutation.mutate(data)
  }

  if (isLoadingOrder) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
        <span className="ml-2 text-[--k-muted]">Chargement...</span>
      </div>
    )
  }

  if (!order || !item) {
    return <div className="py-8 text-center text-[--k-danger]">Article introuvable</div>
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
        {...register('siteId', { required: 'Site requis' })}
      >
        <option value="">Sélectionner un site</option>
        {storageSites.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>

      <Input
        id="receivedQty"
        type="number"
        label="Quantité reçue *"
        min={1}
        error={errors.receivedQty?.message}
        {...register('receivedQty', {
          required: 'Quantité requise',
          min: { value: 1, message: 'Minimum 1' },
        })}
      />

      {receivedQty && Number(receivedQty) !== item.quantity && (
        <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700 border border-amber-200">
          <strong>Attention :</strong> La quantité reçue ({receivedQty}) diffère de la quantité commandée ({item.quantity}).
        </div>
      )}

      <Select id="condition" label="État du produit *" error={errors.condition?.message} {...register('condition')}>
        <option value="NEW">Neuf</option>
        <option value="USED">Occasion</option>
      </Select>

      <div className="space-y-1">
        <label htmlFor="comment" className="block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <textarea
          id="comment"
          rows={2}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
          placeholder="Commentaire optionnel..."
          {...register('comment')}
        />
      </div>

      {receiveMutation.error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700 border border-red-200">
          {(receiveMutation.error as any)?.response?.data?.error || 'Erreur lors de la réception'}
        </div>
      )}

      <div className="rounded-xl bg-emerald-50 p-4 text-[13px] border border-emerald-200">
        <p className="font-medium text-emerald-900 mb-2">Cette action va :</p>
        <ul className="list-disc list-inside space-y-1 text-emerald-700">
          <li>
            Créer un mouvement d'<strong>entrée</strong> de {receivedQty || item.quantity} unité(s)
            {condition === 'NEW' ? ' (neuf)' : ' (occasion)'}
            vers <strong>{selectedSite?.name || 'le site sélectionné'}</strong>
          </li>
          <li>Mettre à jour le <strong>stock</strong> en conséquence</li>
          <li>Si tous les articles sont reçus, la commande sera marquée <strong>terminée</strong></li>
        </ul>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" isLoading={receiveMutation.isPending}>
          Confirmer la réception
        </Button>
      </div>
    </form>
  )
}
