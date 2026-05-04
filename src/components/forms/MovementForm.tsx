import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import ProductSearch from '../ui/ProductSearch'
import api from '../../services/api'
import type { Product, Site, ApiResponse, MovementType, ProductCondition } from '../../types'

interface MovementFormData {
  productId: string
  type: MovementType
  sourceSiteId?: string
  targetSiteId?: string
  quantity: number
  condition: ProductCondition
  movementDate: string
  comment?: string
}

interface MovementFormProps {
  onSuccess: () => void
  onCancel: () => void
  preselectedProductId?: string
  preselectedProduct?: Product | null
}

export default function MovementForm({ onSuccess, onCancel, preselectedProductId, preselectedProduct }: MovementFormProps) {
  const queryClient = useQueryClient()
  const [selectedProductId, setSelectedProductId] = useState(preselectedProductId || '')
  const [productError, setProductError] = useState<string | undefined>()

  useEffect(() => {
    if (preselectedProductId) setSelectedProductId(preselectedProductId)
  }, [preselectedProductId])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MovementFormData>({
    defaultValues: {
      productId: preselectedProductId || '',
      type: 'IN',
      condition: 'NEW',
      movementDate: new Date().toISOString().split('T')[0],
      quantity: 1,
      sourceSiteId: '',
      targetSiteId: '',
      comment: '',
    },
  })

  const movementType = watch('type')
  const sourceSiteId = watch('sourceSiteId')
  const condition = watch('condition')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(preselectedProduct || null)

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites')
      return res.data?.data
    },
  })

  const storageSites = sites?.filter((s) => s.type === 'STORAGE') || []
  const allSites = sites || []

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      const payload = {
        ...data,
        quantity: Number(data.quantity),
        movementDate: new Date(data.movementDate).toISOString(),
        sourceSiteId: data.sourceSiteId || undefined,
        targetSiteId: data.targetSiteId || undefined,
        comment: data.comment || undefined,
      }
      const res = await api.post('/movements', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['stocks'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] })
      onSuccess()
    },
  })

  const onSubmit = (data: MovementFormData) => {
    if (!selectedProductId) {
      setProductError('Produit requis')
      return
    }
    setProductError(undefined)
    createMutation.mutate({ ...data, productId: selectedProductId })
  }

  const handleProductChange = (productId: string, product: Product | null) => {
    setSelectedProductId(productId)
    setSelectedProduct(product)
    setValue('sourceSiteId', '')
    if (productId) setProductError(undefined)
  }

  useEffect(() => {
    if (movementType === 'OUT' || movementType === 'TRANSFER') {
      setValue('sourceSiteId', '')
    }
  }, [condition, setValue, movementType])

  const showSourceSite = movementType === 'OUT' || movementType === 'TRANSFER'
  const showTargetSite = movementType === 'IN' || movementType === 'TRANSFER'

  const productStockSiteIds = selectedProduct?.stocks
    ?.filter((stock) => {
      if (condition === 'NEW') return stock.quantityNew > 0
      if (condition === 'USED') return stock.quantityUsed > 0
      return stock.quantityNew + stock.quantityUsed > 0
    })
    .map((stock) => stock.siteId) || []

  const sourceSiteOptions =
    movementType === 'OUT' || movementType === 'TRANSFER'
      ? allSites.filter((s) => productStockSiteIds.includes(s.id))
      : storageSites

  const targetSiteOptions = storageSites.filter((s) => s.id !== sourceSiteId)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <ProductSearch
        onChange={handleProductChange}
        error={productError}
        initialProduct={preselectedProduct}
      />

      <Select id="type" label="Type de mouvement *" error={errors.type?.message} {...register('type')}>
        <option value="IN">Entrée (réception)</option>
        <option value="OUT">Sortie (utilisation)</option>
        <option value="TRANSFER">Transfert (entre sites)</option>
      </Select>

      <Select id="condition" label="État du produit *" error={errors.condition?.message} {...register('condition')}>
        <option value="NEW">Neuf</option>
        <option value="USED">Occasion</option>
      </Select>

      {showSourceSite && (
        <Select
          id="sourceSiteId"
          label={`Site source ${movementType === 'OUT' || movementType === 'TRANSFER' ? '*' : ''}`}
          error={errors.sourceSiteId?.message}
          {...register('sourceSiteId')}
        >
          <option value="">
            {selectedProduct
              ? sourceSiteOptions.length > 0
                ? 'Sélectionner le site source'
                : `Aucun stock ${condition === 'NEW' ? 'neuf' : 'occasion'} disponible`
              : "Sélectionner d'abord un produit"}
          </option>
          {sourceSiteOptions.map((site) => {
            const stock = selectedProduct?.stocks?.find((s) => s.siteId === site.id)
            const availableQty = stock ? (condition === 'NEW' ? stock.quantityNew : stock.quantityUsed) : 0
            return (
              <option key={site.id} value={site.id}>
                {site.name} - {availableQty} dispo ({condition === 'NEW' ? 'neuf' : 'occasion'})
              </option>
            )
          })}
        </Select>
      )}

      {showTargetSite && (
        <Select
          id="targetSiteId"
          label={`Site cible ${movementType === 'IN' || movementType === 'TRANSFER' ? '*' : ''}`}
          error={errors.targetSiteId?.message}
          {...register('targetSiteId')}
        >
          <option value="">Sélectionner le site cible</option>
          {targetSiteOptions.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </Select>
      )}

      <Input
        id="quantity"
        type="number"
        label="Quantité *"
        min={1}
        error={errors.quantity?.message}
        {...register('quantity', { required: 'Quantité requise', min: { value: 1, message: 'Minimum 1' } })}
      />

      <Input
        id="movementDate"
        type="date"
        label="Date du mouvement *"
        error={errors.movementDate?.message}
        {...register('movementDate', { required: 'Date requise' })}
      />

      <div className="space-y-1">
        <label htmlFor="comment" className="block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <textarea
          id="comment"
          rows={3}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
          placeholder="Commentaire optionnel..."
          {...register('comment')}
        />
      </div>

      {createMutation.error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700 border border-red-200">
          {(createMutation.error as any)?.response?.data?.error || 'Erreur lors de la création'}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" isLoading={createMutation.isPending}>
          Créer le mouvement
        </Button>
      </div>
    </form>
  )
}
