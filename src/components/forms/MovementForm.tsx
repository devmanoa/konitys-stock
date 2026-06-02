import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import ProductSearch from '../ui/ProductSearch'
import api from '../../services/api'
import RichTextEditor from '../ui/RichTextEditor'
import type { Product, Site, ApiResponse, MovementType, ProductCondition, ProductSerialItem } from '../../types'

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
    control,
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
  const quantity = watch('quantity')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(preselectedProduct || null)

  // Serial-tracked workflow state
  const [serialInputs, setSerialInputs] = useState<string[]>([])
  const [selectedSerialIds, setSelectedSerialIds] = useState<string[]>([])
  const [borneNumber, setBorneNumber] = useState('')

  const isSerialTracked = !!selectedProduct?.hasSerialNumber

  // Sync number of inputs with quantity (only for serial-tracked IN)
  useEffect(() => {
    if (!isSerialTracked || movementType !== 'IN') return
    const qty = Math.max(0, Number(quantity) || 0)
    setSerialInputs((prev) => {
      if (prev.length === qty) return prev
      if (prev.length < qty) return [...prev, ...Array(qty - prev.length).fill('')]
      return prev.slice(0, qty)
    })
  }, [quantity, isSerialTracked, movementType])

  // Reset inputs when leaving IN
  useEffect(() => {
    if (movementType !== 'IN') setSerialInputs([])
  }, [movementType])

  // Compute duplicates (trimmed, case-sensitive — serials are alphanumeric IDs)
  const duplicateSerials = (() => {
    const seen = new Map<string, number>()
    serialInputs.forEach((s) => {
      const v = s.trim()
      if (!v) return
      seen.set(v, (seen.get(v) || 0) + 1)
    })
    return new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([v]) => v))
  })()

  // For OUT/TRANSFER: list of available serial items at sourceSite with the chosen condition
  const { data: availableSerialItems = [] } = useQuery({
    queryKey: ['serial-items-pick', selectedProductId, sourceSiteId, condition],
    queryFn: async () => {
      if (!selectedProductId || !sourceSiteId) return []
      const params = new URLSearchParams()
      params.set('status', 'IN_STOCK')
      params.set('siteId', sourceSiteId)
      params.set('condition', condition)
      const res = await api.get<ApiResponse<ProductSerialItem[]>>(
        `/products/${selectedProductId}/serial-items?${params.toString()}`,
      )
      return res.data?.data || []
    },
    enabled:
      isSerialTracked &&
      (movementType === 'OUT' || movementType === 'TRANSFER') &&
      !!sourceSiteId,
  })

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
      const payload: any = {
        ...data,
        quantity: Number(data.quantity),
        movementDate: new Date(data.movementDate).toISOString(),
        sourceSiteId: data.sourceSiteId || undefined,
        targetSiteId: data.targetSiteId || undefined,
        comment: data.comment || undefined,
      }
      if (isSerialTracked) {
        if (data.type === 'IN') {
          const filled = serialInputs.map((s) => s.trim()).filter((s) => s.length > 0)
          if (filled.length > 0) payload.serialNumbers = filled
        } else if (data.type === 'OUT' || data.type === 'TRANSFER') {
          payload.serialItemIds = selectedSerialIds
          payload.quantity = selectedSerialIds.length
          if (data.type === 'OUT' && borneNumber) payload.borneNumber = borneNumber
        }
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
    if (isSerialTracked && data.type === 'IN' && duplicateSerials.size > 0) {
      return
    }
    if (isSerialTracked && (data.type === 'OUT' || data.type === 'TRANSFER')) {
      if (selectedSerialIds.length === 0) {
        return
      }
    }
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

      {!(isSerialTracked && (movementType === 'OUT' || movementType === 'TRANSFER')) && (
        <Input
          id="quantity"
          type="number"
          label="Quantité *"
          min={1}
          error={errors.quantity?.message}
          {...register('quantity', { required: 'Quantité requise', min: { value: 1, message: 'Minimum 1' } })}
        />
      )}

      {isSerialTracked && movementType === 'IN' && serialInputs.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[--k-text]">
            Numéros de série
          </label>
          <div className="space-y-1.5">
            {serialInputs.map((value, idx) => {
              const trimmed = value.trim()
              const isDup = trimmed.length > 0 && duplicateSerials.has(trimmed)
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[12px] text-[--k-muted] w-6 text-right">#{idx + 1}</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const next = [...serialInputs]
                      next[idx] = e.target.value
                      setSerialInputs(next)
                    }}
                    placeholder="N° de série (optionnel)"
                    className={`input-field flex-1 font-mono text-[13px] ${
                      isDup ? 'border-red-400 focus:border-red-500' : ''
                    }`}
                  />
                  {isDup && (
                    <span className="text-[11px] text-red-600 font-medium">Doublon</span>
                  )}
                </div>
              )
            })}
          </div>
          {duplicateSerials.size > 0 && (
            <p className="text-xs text-red-600">
              {duplicateSerials.size} doublon(s) détecté(s) — corrigez avant de valider.
            </p>
          )}
          <p className="text-xs text-[--k-muted]">
            Laissez vide pour créer un exemplaire avec n° « à compléter ».
          </p>
        </div>
      )}

      {isSerialTracked && (movementType === 'OUT' || movementType === 'TRANSFER') && (
        <div className="space-y-1">
          <label className="block text-[13px] font-medium text-[--k-text]">
            Numéros de série à sortir *
          </label>
          {!sourceSiteId ? (
            <p className="text-xs text-[--k-muted] italic py-2">
              Sélectionnez d'abord un site source.
            </p>
          ) : availableSerialItems.length === 0 ? (
            <p className="text-xs text-[--k-muted] italic py-2">
              Aucun exemplaire en stock {condition === 'NEW' ? 'neuf' : 'occasion'} sur ce site.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[--k-border] divide-y divide-[--k-border]">
              {availableSerialItems.map((it) => {
                const checked = selectedSerialIds.includes(it.id)
                return (
                  <label
                    key={it.id}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[--k-surface-2]/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSerialIds([...selectedSerialIds, it.id])
                        else setSelectedSerialIds(selectedSerialIds.filter((id) => id !== it.id))
                      }}
                      className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
                    />
                    <span className="font-mono text-[12px] text-[--k-text]">
                      {it.serialNumber || <span className="italic text-amber-600">(à compléter)</span>}
                    </span>
                    <span className="ml-auto text-[11px] text-[--k-muted]">
                      Entrée le {new Date(it.enteredAt).toLocaleDateString('fr-FR')}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          <p className="text-xs text-[--k-muted]">
            {selectedSerialIds.length} sélectionné(s)
          </p>
        </div>
      )}

      {isSerialTracked && movementType === 'OUT' && (
        <Input
          label="N° borne"
          value={borneNumber}
          onChange={(e) => setBorneNumber(e.target.value)}
          placeholder="N° de la borne installée (optionnel)"
        />
      )}

      <Input
        id="movementDate"
        type="date"
        label="Date du mouvement *"
        error={errors.movementDate?.message}
        {...register('movementDate', { required: 'Date requise' })}
      />

      <div className="space-y-1">
        <label className="block text-[13px] font-medium text-[--k-text]">
          Commentaire
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
