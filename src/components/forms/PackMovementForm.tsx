import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import api from '../../services/api'
import type { Pack, Site, ApiResponse } from '../../types'

interface PackItem {
  id: string
  productId: string
  productReference: string
  productDescription?: string
  quantity: number
  condition: 'NEW' | 'USED'
}

interface PackMovementFormData {
  type: 'IN' | 'OUT'
  packId: string
  packQuantity: number
  siteId: string
  movementDate: string
  operator?: string
  comment?: string
  items: PackItem[]
}

interface PackMovementFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function PackMovementForm({ onSuccess, onCancel }: PackMovementFormProps) {
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    control,
  } = useForm<PackMovementFormData>({
    defaultValues: {
      type: 'OUT',
      packQuantity: 1,
      movementDate: new Date().toISOString().split('T')[0],
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const movementType = watch('type')
  const packId = watch('packId')
  const packQuantity = watch('packQuantity')

  const { data: packs } = useQuery({
    queryKey: ['packs', movementType],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Pack[]>>(`/packs?type=${movementType}`)
      return res.data?.data
    },
    enabled: !!movementType,
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites')
      return res.data?.data
    },
  })

  const selectedPack = packs?.find((p) => p.id === packId)

  useEffect(() => {
    if (selectedPack && selectedPack.items) {
      while (fields.length > 0) remove(0)
      selectedPack.items.forEach((item) => {
        append({
          id: item.id,
          productId: item.productId,
          productReference: item.product.reference,
          productDescription: item.product.description,
          quantity: item.quantity * (packQuantity || 1),
          condition: 'NEW',
        })
      })
    }
  }, [selectedPack, packId])

  const createMovementsMutation = useMutation({
    mutationFn: async (data: PackMovementFormData) => {
      const baseItems = selectedPack?.items || []
      const movements = data.items.map((item) => {
        const baseItem = baseItems.find((bi) => bi.productId === item.productId)
        const calculatedQuantity = (baseItem?.quantity || 1) * (data.packQuantity || 1)
        return {
          productId: item.productId,
          type: data.type,
          quantity: calculatedQuantity,
          condition: item.condition,
          movementDate: new Date(data.movementDate).toISOString(),
          operator: data.operator || undefined,
          comment: data.comment
            ? `[Pack: ${selectedPack?.name}] ${data.comment}`
            : `[Pack: ${selectedPack?.name}]`,
          ...(data.type === 'IN' ? { targetSiteId: data.siteId } : { sourceSiteId: data.siteId }),
        }
      })
      for (const movement of movements) {
        await api.post('/movements', movement)
      }
      return movements.length
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['stocks'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] })
      onSuccess()
    },
    onError: (error: any) => {
      setSubmitError(error?.response?.data?.error || 'Erreur lors de la création des mouvements')
    },
  })

  const onSubmit = (data: PackMovementFormData) => {
    setSubmitError(null)
    if (data.items.length === 0) {
      setSubmitError('Veuillez sélectionner un pack avec des articles')
      return
    }
    createMovementsMutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-[13px] font-medium text-[--k-text] mb-2">
          Type de mouvement <span className="text-[--k-danger]">*</span>
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="IN"
              {...register('type', { required: 'Type de mouvement requis' })}
              className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
            />
            <span className="text-[13px] text-[--k-text]">Entrée (IN)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="OUT"
              {...register('type', { required: 'Type de mouvement requis' })}
              className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
            />
            <span className="text-[13px] text-[--k-text]">Sortie (OUT)</span>
          </label>
        </div>
        {errors.type && <p className="mt-1 text-[13px] text-[--k-danger]">{errors.type.message}</p>}
      </div>

      <Select label="Pack *" error={errors.packId?.message} {...register('packId', { required: 'Pack requis' })}>
        <option value="">Sélectionner un pack...</option>
        {packs?.map((pack) => (
          <option key={pack.id} value={pack.id}>
            {pack.name} ({pack.items?.length || 0} articles)
          </option>
        ))}
      </Select>

      <Input
        label="Quantité du pack *"
        type="number"
        error={errors.packQuantity?.message}
        {...register('packQuantity', {
          required: 'Quantité du pack requise',
          min: { value: 1, message: 'Quantité doit être au moins 1' },
          valueAsNumber: true,
        })}
        placeholder="Entrez la quantité du pack"
      />

      {selectedPack && (
        <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2 text-[13px]">Détails du pack</h4>
          <div className="space-y-1 text-[13px] text-blue-800">
            <p><strong>Nom:</strong> {selectedPack.name}</p>
            {selectedPack.description && <p><strong>Description:</strong> {selectedPack.description}</p>}
            <p><strong>Nombre d'articles:</strong> {selectedPack.items?.length || 0}</p>
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <div>
          <label className="block text-[13px] font-medium text-[--k-text] mb-3">
            Articles <span className="text-[--k-danger]">*</span>
          </label>
          <div className="space-y-3 bg-[--k-surface-2] rounded-xl p-4 border border-[--k-border]">
            {fields.map((field, index) => {
              const baseQuantity = selectedPack?.items?.find((item) => item.productId === field.productId)?.quantity || 0
              const calculatedQuantity = baseQuantity * (packQuantity || 1)
              return (
                <div key={field.id} className="flex gap-3 items-start bg-[--k-surface] p-3 rounded-lg border border-[--k-border]">
                  <input type="hidden" {...register(`items.${index}.id`)} />
                  <input type="hidden" {...register(`items.${index}.productId`)} />
                  <input type="hidden" {...register(`items.${index}.productReference`)} />
                  <input type="hidden" {...register(`items.${index}.productDescription`)} />

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-medium text-[--k-muted] mb-1">Produit</label>
                    <div className="text-[13px] bg-[--k-surface-2] px-3 py-2 rounded-lg text-[--k-text]">
                      {watch(`items.${index}.productReference`)}
                      {watch(`items.${index}.productDescription`) && (
                        <span className="block text-[11px] text-[--k-muted] mt-1">
                          {watch(`items.${index}.productDescription`)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-[11px] font-medium text-[--k-muted] mb-1">Quantité</label>
                    <div className="text-[13px] bg-[--k-surface-2] px-3 py-2 rounded-lg text-[--k-text] font-medium">
                      {calculatedQuantity}
                      <span className="text-[11px] text-[--k-muted] block mt-1">
                        ({baseQuantity} × {packQuantity})
                      </span>
                    </div>
                    <input type="hidden" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-[11px] font-medium text-[--k-muted] mb-1">État</label>
                    <Select {...register(`items.${index}.condition`)} className="w-full">
                      <option value="NEW">Neuf</option>
                      <option value="USED">Occasion</option>
                    </Select>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-[--k-danger] hover:bg-red-50 rounded-lg transition"
                      title="Supprimer cet article"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Select
        label={`${movementType === 'OUT' ? 'Site source' : 'Site cible'} *`}
        error={errors.siteId?.message}
        {...register('siteId', {
          required: movementType === 'OUT' ? 'Site source requis' : 'Site cible requis',
        })}
      >
        <option value="">Sélectionner un site...</option>
        {sites
          ?.filter((site) => site.type === 'STORAGE')
          .map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
      </Select>

      <Input
        label="Date du mouvement *"
        type="date"
        error={errors.movementDate?.message}
        {...register('movementDate', { required: 'Date du mouvement requise' })}
      />

      <Input label="Opérateur" type="text" {...register('operator')} placeholder="Nom de l'opérateur (optionnel)" />

      <div>
        <label className="block text-[13px] font-medium text-[--k-text] mb-1">Commentaire</label>
        <textarea
          {...register('comment')}
          placeholder="Ajouter un commentaire (optionnel)"
          rows={3}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
        />
      </div>

      {submitError && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700 border border-red-200">
          {submitError}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-6 border-t border-[--k-border]">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={createMovementsMutation.isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={createMovementsMutation.isPending || fields.length === 0} isLoading={createMovementsMutation.isPending}>
          Créer {fields.length} mouvement{fields.length > 1 ? 's' : ''}
        </Button>
      </div>
    </form>
  )
}
