import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import api from '../../services/api'
import type { Site, SiteType, ApiResponse } from '../../types'

interface CreateSiteInput {
  name: string
  type: SiteType
  address?: string
  isActive?: boolean
}

interface SiteFormProps {
  site?: Site
  onSuccess: () => void
  onCancel: () => void
}

export default function SiteForm({ site, onSuccess, onCancel }: SiteFormProps) {
  const queryClient = useQueryClient()
  const isEditing = !!site

  const [formData, setFormData] = useState<CreateSiteInput>({
    name: '',
    type: 'STORAGE',
    address: '',
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name,
        type: site.type,
        address: site.address || '',
        isActive: site.isActive,
      })
    }
  }, [site])

  const createMutation = useMutation({
    mutationFn: async (data: CreateSiteInput) => {
      const res = await api.post<ApiResponse<Site>>('/sites', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onSuccess()
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {}
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message
        })
        setErrors(fieldErrors)
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: CreateSiteInput) => {
      const res = await api.put<ApiResponse<Site>>(`/sites/${site!.id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      onSuccess()
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {}
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message
        })
        setErrors(fieldErrors)
      }
    },
  })

  const handleChange = (field: keyof CreateSiteInput, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Le nom est requis'
    if (!formData.type) newErrors.type = 'Le type est requis'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const data = {
      ...formData,
      address: formData.address || undefined,
    }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Nom <span className="text-[--k-danger]">*</span>
        </label>
        <Input
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Nom du site"
          error={errors.name}
        />
      </div>

      <div>
        <Select
          label="Type *"
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value as SiteType)}
          error={errors.type}
        >
          <option value="STORAGE">Stockage</option>
          <option value="EXIT">Sortie</option>
        </Select>
        <p className="mt-1 text-[11px] text-[--k-muted]">
          {formData.type === 'STORAGE'
            ? 'Site de stockage : pour entreposer les produits'
            : 'Site de sortie : point de distribution ou chantier'}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">Adresse</label>
        <textarea
          value={formData.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="Adresse du site"
          rows={2}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => handleChange('isActive', e.target.checked)}
          className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
        />
        <label htmlFor="isActive" className="text-[13px] text-[--k-text]">
          Site actif
        </label>
      </div>

      <div className="flex justify-end gap-3 border-t border-[--k-border] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading} isLoading={isLoading}>
          {isEditing ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  )
}
