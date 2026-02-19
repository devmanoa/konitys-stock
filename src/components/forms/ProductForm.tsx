import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ImagePlus, X, Upload, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import api from '../../services/api';
import type { Product, CreateProductInput, SupplyRisk, ApiResponse, Assembly, AssemblyType, PartCategory, PaginatedResponse } from '../../types';

// Remove /api suffix for static files URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [formData, setFormData] = useState<CreateProductInput>({
    reference: '',
    description: '',
    qtyPerUnit: 1,
    supplyRisk: undefined,
    minStock: null,
    location: '',
    assemblyId: '',
    assemblyTypeId: '',
    comment: '',
    imageUrl: '',
    partCategoryIds: [],
  });

  // Fetch assembly types for filter
  const { data: assemblyTypesData } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<AssemblyType>>('/assembly-types?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch assemblies for select
  const { data: assembliesData } = useQuery({
    queryKey: ['assemblies'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Assembly>>('/assemblies?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch part categories for selected assembly type
  const { data: partCategoriesData } = useQuery({
    queryKey: ['part-categories', formData.assemblyTypeId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PartCategory[]>>(`/assembly-types/${formData.assemblyTypeId}/part-categories`);
      return res.data?.data || [];
    },
    enabled: !!formData.assemblyTypeId,
  });

  // Filter assemblies by selected type
  const filteredAssemblies = formData.assemblyTypeId
    ? assembliesData?.filter((assembly) =>
        assembly.assemblyTypes?.some((at: any) =>
          at.assemblyTypeId === formData.assemblyTypeId || at.id === formData.assemblyTypeId
        )
      )
    : assembliesData;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        reference: product.reference,
        description: product.description || '',
        qtyPerUnit: product.qtyPerUnit,
        supplyRisk: product.supplyRisk,
        minStock: product.minStock ?? null,
        location: product.location || '',
        assemblyId: product.assemblyId || '',
        assemblyTypeId: product.assemblyTypeId || '',
        comment: product.comment || '',
        imageUrl: product.imageUrl || '',
        partCategoryIds: product.partCategories?.map(pc => pc.partCategoryId) || [],
      });
    }
  }, [product]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const res = await api.post<ApiResponse<Product>>('/products', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const res = await api.put<ApiResponse<Product>>(`/products/${product!.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.details) {
        const fieldErrors: Record<string, string> = {};
        error.response.data.details.forEach((e: { field: string; message: string }) => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      }
    },
  });

  const handleChange = (field: keyof CreateProductInput, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reference.trim()) {
      newErrors.reference = 'La référence est requise';
    } else if (formData.reference.length > 50) {
      newErrors.reference = 'La référence ne doit pas dépasser 50 caractères';
    }

    if (formData.qtyPerUnit && formData.qtyPerUnit < 1) {
      newErrors.qtyPerUnit = 'La quantité doit être au moins 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      ...formData,
      qtyPerUnit: formData.qtyPerUnit || 1,
      supplyRisk: formData.supplyRisk || undefined,
      minStock: formData.minStock != null && formData.minStock >= 0 ? formData.minStock : null,
      assemblyId: formData.assemblyId || undefined,
      assemblyTypeId: formData.assemblyTypeId || undefined,
      partCategoryIds: formData.partCategoryIds?.length ? formData.partCategoryIds : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, image: 'Type de fichier non supporté. Utilisez JPEG, PNG, GIF ou WebP' }));
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Le fichier ne doit pas dépasser 5 Mo' }));
      return;
    }

    setIsUploading(true);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.image;
      return newErrors;
    });

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);

      const res = await api.post('/upload/image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        handleChange('imageUrl', res.data?.data?.imageUrl);
      }
    } catch (error: any) {
      setErrors(prev => ({ ...prev, image: error.response?.data?.error || 'Erreur lors de l\'upload' }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    handleChange('imageUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Référence <span className="text-[--k-danger]">*</span>
          </label>
          <Input
            value={formData.reference}
            onChange={(e) => handleChange('reference', e.target.value)}
            placeholder="Ex: ABC123"
            disabled={isEditing}
            className={errors.reference ? 'border-[--k-danger]' : ''}
          />
          {errors.reference && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.reference}</p>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Quantité par unité
          </label>
          <Input
            type="number"
            min={1}
            value={formData.qtyPerUnit || ''}
            onChange={(e) => handleChange('qtyPerUnit', parseInt(e.target.value) || 1)}
            placeholder="1"
          />
          {errors.qtyPerUnit && (
            <p className="mt-1 text-[13px] text-[--k-danger]">{errors.qtyPerUnit}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Description
        </label>
        <Input
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Description du produit"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Type borne
          </label>
          <Select
            value={formData.assemblyTypeId || ''}
            onChange={(e) => {
              handleChange('assemblyTypeId', e.target.value || undefined);
              // Reset part categories when type changes
              setFormData(prev => ({ ...prev, partCategoryIds: [] }));
              // Reset assembly if changing type filter
              if (e.target.value && formData.assemblyId) {
                const assembly = assembliesData?.find(a => a.id === formData.assemblyId);
                const hasType = assembly?.assemblyTypes?.some((at: any) =>
                  at.assemblyTypeId === e.target.value || at.id === e.target.value
                );
                if (!hasType) {
                  handleChange('assemblyId', undefined);
                }
              }
            }}
          >
            <option value="">Aucun type</option>
            {assemblyTypesData?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Borne
          </label>
          <Select
            value={formData.assemblyId || ''}
            onChange={(e) => handleChange('assemblyId', e.target.value || undefined)}
          >
            <option value="">Aucune borne</option>
            {filteredAssemblies?.map((assembly) => (
              <option key={assembly.id} value={assembly.id}>
                {assembly.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Risque approvisionnement
          </label>
          <Select
            value={formData.supplyRisk || ''}
            onChange={(e) => handleChange('supplyRisk', e.target.value as SupplyRisk || undefined)}
          >
            <option value="">Non défini</option>
            <option value="LOW">Faible</option>
            <option value="MEDIUM">Moyen</option>
            <option value="HIGH">Fort</option>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Emplacement
          </label>
          <Input
            value={formData.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="Ex: A1-B2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Seuil critique
          </label>
          <Input
            type="number"
            min={0}
            value={formData.minStock != null ? formData.minStock : ''}
            onChange={(e) => handleChange('minStock', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
            placeholder="Pas de seuil"
          />
          <p className="mt-1 text-xs text-[--k-muted]">
            Alerte si stock total en dessous de ce seuil
          </p>
        </div>
      </div>

      {/* Catégories de pièces */}
      {formData.assemblyTypeId && partCategoriesData && partCategoriesData.length > 0 && (
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Catégories de pièces
          </label>
          <div className="flex flex-wrap gap-2 border border-[--k-border] rounded-lg p-3">
            {partCategoriesData.map((cat) => {
              const isSelected = formData.partCategoryIds?.includes(cat.id) || false;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      partCategoryIds: isSelected
                        ? (prev.partCategoryIds || []).filter(id => id !== cat.id)
                        : [...(prev.partCategoryIds || []), cat.id],
                    }));
                  }}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[--k-primary] text-white'
                      : 'border border-[--k-border] bg-[--k-surface] text-[--k-text] hover:bg-[--k-surface-2]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Image Upload */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Image du produit
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        {formData.imageUrl ? (
          <div className="flex items-start gap-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-[--k-border] bg-[--k-surface-2]">
              <img
                src={getFullImageUrl(formData.imageUrl)}
                alt="Aperçu"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Changer
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="text-[--k-danger] hover:bg-red-50"
              >
                <X className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-[--k-border] bg-[--k-bg] hover:border-[--k-primary] hover:bg-[--k-surface-2]"
          >
            {isUploading ? (
              <div className="flex flex-col items-center text-[--k-muted]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="mt-2 text-[13px]">Upload en cours...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-[--k-muted]">
                <ImagePlus className="h-8 w-8" />
                <span className="mt-2 text-[13px]">Cliquez pour ajouter une image</span>
                <span className="text-xs text-[--k-muted]">JPEG, PNG, GIF, WebP (max 5 Mo)</span>
              </div>
            )}
          </button>
        )}
        {errors.image && (
          <p className="mt-1 text-[13px] text-[--k-danger]">{errors.image}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <textarea
          value={formData.comment || ''}
          onChange={(e) => handleChange('comment', e.target.value)}
          placeholder="Notes ou commentaires..."
          rows={3}
          className="input-field"
          style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-[--k-border] pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
}
