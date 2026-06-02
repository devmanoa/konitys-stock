import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, ExternalLink } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import api from '../../services/api'
import RichTextEditor from '../ui/RichTextEditor'
import type { Pack, Site, ApiResponse } from '../../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return '/default-product.svg'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`
  return url
}

interface PackItem {
  id: string
  productId: string
  productReference: string
  productDescription?: string
  productImageUrl?: string
  quantity: number
  condition: 'NEW' | 'USED'
}

interface PackMovementFormData {
  type: 'IN' | 'OUT'
  packId: string
  packQuantity: number
  siteId: string
  movementDate: string
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
  const dirtyItemsRef = useRef<Set<string>>(new Set())

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
    queryKey: ['packs'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Pack[]>>('/packs')
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

  const selectedPack = packs?.find((p) => p.id === packId)

  useEffect(() => {
    if (selectedPack && selectedPack.items) {
      dirtyItemsRef.current = new Set()
      while (fields.length > 0) remove(0)
      selectedPack.items.forEach((item) => {
        append({
          id: item.id,
          productId: item.productId,
          productReference: item.product.reference,
          productDescription: item.product.description,
          productImageUrl: item.product.imageUrl,
          quantity: item.quantity * (packQuantity || 1),
          condition: 'NEW',
        })
      })
    }
  }, [selectedPack, packId])

  // Recalc quantities when packQuantity changes, but skip items the user manually edited
  useEffect(() => {
    if (!selectedPack?.items) return
    fields.forEach((field, index) => {
      if (dirtyItemsRef.current.has(field.productId)) return
      const baseItem = selectedPack.items.find((it) => it.productId === field.productId)
      if (!baseItem) return
      setValue(`items.${index}.quantity`, baseItem.quantity * (packQuantity || 1))
    })
  }, [packQuantity, fields, selectedPack, setValue])

  const createMovementsMutation = useMutation({
    mutationFn: async (data: PackMovementFormData) => {
      // Use the user-entered quantity per item
      const movements = data.items.map((item) => ({
        productId: item.productId,
        type: data.type,
        quantity: item.quantity,
        condition: item.condition,
        movementDate: new Date(data.movementDate).toISOString(),
        comment: data.comment
          ? `[Pack: ${selectedPack?.name}] ${data.comment}`
          : `[Pack: ${selectedPack?.name}]`,
        ...(data.type === 'IN' ? { targetSiteId: data.siteId } : { sourceSiteId: data.siteId }),
      }))
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
              const suggestedQuantity = baseQuantity * (packQuantity || 1)
              const currentQuantity = watch(`items.${index}.quantity`)
              const isDirty = dirtyItemsRef.current.has(field.productId)
              return (
                <div key={field.id} className="flex gap-3 items-start bg-[--k-surface] p-3 rounded-lg border border-[--k-border]">
                  <input type="hidden" {...register(`items.${index}.id`)} />
                  <input type="hidden" {...register(`items.${index}.productId`)} />
                  <input type="hidden" {...register(`items.${index}.productReference`)} />
                  <input type="hidden" {...register(`items.${index}.productDescription`)} />
                  <input type="hidden" {...register(`items.${index}.productImageUrl`)} />

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-medium text-[--k-muted] mb-1">Produit</label>
                    <div className="flex items-center gap-3 bg-[--k-surface-2] px-3 py-2 rounded-lg">
                      <img
                        src={watch(`items.${index}.productImageUrl`) ? getFullImageUrl(watch(`items.${index}.productImageUrl`)) : '/default-product.svg'}
                        alt={watch(`items.${index}.productReference`)}
                        className="h-10 w-10 rounded-lg object-cover bg-white flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default-product.svg' }}
                      />
                      <div className="min-w-0 flex-1">
                        {watch(`items.${index}.productDescription`) && (
                          <span className="block text-[13px] font-medium text-[--k-text]">
                            {watch(`items.${index}.productDescription`)}
                          </span>
                        )}
                        <span className="block text-[11px] text-[--k-muted]">
                          {watch(`items.${index}.productReference`)}
                        </span>
                      </div>
                      <a
                        href={`/products/${watch(`items.${index}.productId`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-[--k-muted] hover:text-[--k-primary]"
                        title="Ouvrir la fiche produit dans un nouvel onglet"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-[11px] font-medium text-[--k-muted] mb-1">Quantité</label>
                    <Input
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity`, {
                        required: true,
                        min: 1,
                        valueAsNumber: true,
                        onChange: () => {
                          dirtyItemsRef.current.add(field.productId)
                        },
                      })}
                    />
                    <span className="text-[11px] text-[--k-muted] block mt-1">
                      {isDirty && currentQuantity !== suggestedQuantity
                        ? `modifié (suggéré : ${suggestedQuantity} = ${baseQuantity} × ${packQuantity})`
                        : `${baseQuantity} × ${packQuantity}`}
                    </span>
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

      <div>
        <label className="block text-[13px] font-medium text-[--k-text] mb-1">Commentaire</label>
        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <RichTextEditor
              content={field.value || ''}
              onChange={field.onChange}
              placeholder="Ajouter un commentaire (optionnel)"
              fetchMentions={() => []}
            />
          )}
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
