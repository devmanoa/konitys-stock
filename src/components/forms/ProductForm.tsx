import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ImagePlus, X, Upload, Loader2, Plus } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import api from '../../services/api';
import RichTextEditor from '../ui/RichTextEditor';
import type { Product, CreateProductInput, SupplyRisk, PartType, ApiResponse, Assembly, AssemblyType, PartCategory, PaginatedResponse, Site, Location as LocationType } from '../../types';
import { PART_TYPE_LABEL } from '../../types';

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
    supplyRisk: undefined,
    partType: null,
    minStock: null,
    location: '',
    assemblyId: '',
    comment: '',
    imageUrl: '',
    partCategoryIds: [],
    hasSerialNumber: false,
  });

  // Selected assembly types with per-type qtyPerUnit
  const [selectedTypes, setSelectedTypes] = useState<{ assemblyTypeId: string; qtyPerUnit: number }[]>([]);

  // Location picker: { siteId, rootId, leafId }. The leaf is what we send as locationId.
  // If the chosen root has no children, leafId === rootId.
  const [locSite, setLocSite] = useState<string>('');
  const [locRoot, setLocRoot] = useState<string>('');
  const [locLeaf, setLocLeaf] = useState<string>('');

  // External links (free-form URLs, ordered)
  const [externalLinks, setExternalLinks] = useState<string[]>([]);

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

  // Fetch all part categories (global, no longer scoped per assembly type)
  const { data: partCategoriesData } = useQuery({
    queryKey: ['part-categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PartCategory[]>>('/part-categories');
      return res.data?.data || [];
    },
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data || [];
    },
  });

  const { data: locationsData = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LocationType[]>>('/locations');
      return res.data?.data || [];
    },
  });

  // Filter assemblies by any of the selected types (or show all if none selected)
  const filteredAssemblies = selectedTypes.length > 0
    ? assembliesData?.filter((assembly) =>
        assembly.assemblyTypes?.some((at: any) =>
          selectedTypes.some(st => st.assemblyTypeId === at.assemblyTypeId || st.assemblyTypeId === at.id)
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
        supplyRisk: product.supplyRisk,
        partType: product.partType ?? null,
        minStock: product.minStock ?? null,
        location: product.location || '',
        assemblyId: product.assemblyId || '',
        comment: product.comment || '',
        imageUrl: product.imageUrl || '',
        partCategoryIds: product.partCategories?.map(pc => pc.partCategoryId) || [],
        hasSerialNumber: product.hasSerialNumber || false,
      });
      setExternalLinks((product.externalLinks || []).map((l) => l.url));
      // Hydrate location picker from the resolved storageLocation (parent + site)
      const loc = product.storageLocation;
      if (loc) {
        const site = loc.site || loc.parent?.site;
        setLocSite(site?.id || '');
        setLocRoot(loc.parent?.id || loc.id);
        setLocLeaf(loc.id);
      } else {
        setLocSite('');
        setLocRoot('');
        setLocLeaf('');
      }
      setSelectedTypes(
        (product.assemblyTypes || []).map(l => ({
          assemblyTypeId: l.assemblyTypeId,
          qtyPerUnit: l.qtyPerUnit,
        })),
      );
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
      if (product?.id) {
        queryClient.invalidateQueries({ queryKey: ['product', product.id] });
        queryClient.invalidateQueries({ queryKey: ['product-audit', product.id] });
      }
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

  const handleChange = (field: keyof CreateProductInput, value: string | number | boolean | undefined) => {
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

    for (const t of selectedTypes) {
      if (!t.qtyPerUnit || t.qtyPerUnit < 1) {
        newErrors.assemblyTypes = 'Chaque type de borne doit avoir une quantité ≥ 1';
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cleanLinks = externalLinks.map((u) => u.trim()).filter((u) => u.length > 0);
    const data = {
      ...formData,
      supplyRisk: formData.supplyRisk || undefined,
      partType: formData.partType || null,
      minStock: formData.minStock != null && formData.minStock >= 0 ? formData.minStock : null,
      assemblyId: formData.assemblyId || undefined,
      assemblyTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
      partCategoryIds: formData.partCategoryIds?.length ? formData.partCategoryIds : undefined,
      externalLinks: cleanLinks,
      locationId: locLeaf || null,
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

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Types de borne — quantité par unité
        </label>
        <p className="mb-2 text-xs text-[--k-muted]">
          Un produit peut être utilisé dans plusieurs types de borne. Indiquez la quantité requise par unité pour chaque type.
        </p>
        <div className="space-y-2 rounded-lg border border-[--k-border] p-3">
          {selectedTypes.length === 0 && (
            <p className="text-xs italic text-[--k-muted]">Aucun type sélectionné.</p>
          )}
          {selectedTypes.map((st) => {
            const type = assemblyTypesData?.find((t) => t.id === st.assemblyTypeId);
            return (
              <div key={st.assemblyTypeId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-[--k-text]">
                  {type?.name || st.assemblyTypeId}
                </span>
                <Input
                  type="number"
                  min={1}
                  value={st.qtyPerUnit}
                  onChange={(e) => {
                    const next = Math.max(1, parseInt(e.target.value) || 1);
                    setSelectedTypes((prev) =>
                      prev.map((p) => (p.assemblyTypeId === st.assemblyTypeId ? { ...p, qtyPerUnit: next } : p)),
                    );
                  }}
                  className="!w-24"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTypes((prev) => prev.filter((p) => p.assemblyTypeId !== st.assemblyTypeId))
                  }
                  className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-danger]"
                  title="Retirer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {assemblyTypesData && assemblyTypesData.some((t) => !selectedTypes.find((st) => st.assemblyTypeId === t.id)) && (
            <Select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                setSelectedTypes((prev) => [...prev, { assemblyTypeId: id, qtyPerUnit: 1 }]);
              }}
            >
              <option value="">+ Ajouter un type…</option>
              {assemblyTypesData
                ?.filter((t) => !selectedTypes.find((st) => st.assemblyTypeId === t.id))
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </Select>
          )}
        </div>
        {errors.assemblyTypes && (
          <p className="mt-1 text-[13px] text-[--k-danger]">{errors.assemblyTypes}</p>
        )}
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
            Type de pièce
          </label>
          <Select
            value={formData.partType || ''}
            onChange={(e) =>
              handleChange('partType', (e.target.value as PartType) || null)
            }
          >
            <option value="">Non défini</option>
            <option value="EQUIPMENT">{PART_TYPE_LABEL.EQUIPMENT}</option>
            <option value="PROTECTION">{PART_TYPE_LABEL.PROTECTION}</option>
            <option value="HARDWARE">{PART_TYPE_LABEL.HARDWARE}</option>
          </Select>
          <p className="text-[11px] text-[--k-muted] mt-1">
            Utilisé par Bornes Factory pour grouper la checklist d'assemblage.
          </p>
        </div>
      </div>

      <div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
            Emplacement
          </label>
          {(() => {
            const allSites = sitesData || [];
            const allLocs = locationsData || [];
            const rootsForSite = allLocs.filter(
              (l) => !l.parentId && l.siteId === locSite,
            );
            const childrenForRoot = allLocs.filter((l) => l.parentId === locRoot);
            return (
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={locSite}
                  onChange={(e) => {
                    setLocSite(e.target.value);
                    setLocRoot('');
                    setLocLeaf('');
                  }}
                >
                  <option value="">— Aucun —</option>
                  {allSites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
                {locSite && rootsForSite.length > 0 && (
                  <Select
                    value={locRoot}
                    onChange={(e) => {
                      const root = e.target.value;
                      setLocRoot(root);
                      const hasKids = allLocs.some((l) => l.parentId === root);
                      // If the chosen root has no children, the leaf == root
                      setLocLeaf(hasKids ? '' : root);
                    }}
                  >
                    <option value="">Choisir l'emplacement…</option>
                    {rootsForSite.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                )}
                {locRoot && childrenForRoot.length > 0 && (
                  <Select
                    value={locLeaf === locRoot ? '' : locLeaf}
                    onChange={(e) => setLocLeaf(e.target.value || locRoot)}
                  >
                    <option value="">— Aucun sous-emplacement —</option>
                    {childrenForRoot.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                )}
                {locSite && rootsForSite.length === 0 && (
                  <p className="text-xs italic text-[--k-muted]">
                    Aucun emplacement défini pour ce lieu. Ajoutez-en depuis la page Sites.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Liens externes
        </label>
        <p className="mb-2 text-xs text-[--k-muted]">
          Liens publics vers la fiche du produit (Amazon, site fournisseur, datasheet…). Ajoute autant de liens que nécessaire.
        </p>
        <div className="space-y-2">
          {externalLinks.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => {
                  setExternalLinks((prev) => prev.map((u, i) => (i === idx ? e.target.value : u)));
                }}
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={() => setExternalLinks((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-danger]"
                title="Retirer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExternalLinks((prev) => [...prev, ''])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un lien
          </Button>
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

      {/* Suivi par numéro de série */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.hasSerialNumber || false}
            onChange={(e) => handleChange('hasSerialNumber', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
          />
          <div>
            <span className="text-[13px] font-medium text-[--k-text]">
              Suivi par numéro de série
            </span>
            <p className="text-xs text-[--k-muted] mt-0.5">
              Chaque exemplaire est tracé individuellement (n° de série, état, statut, client final).
              {isEditing && product?.hasSerialNumber === false && (
                <span className="block mt-1 text-amber-600">
                  ⚠️ Activer cette option créera des exemplaires "à compléter" pour chaque unité actuellement en stock.
                </span>
              )}
            </p>
          </div>
        </label>
      </div>

      {/* Catégories de pièces */}
      {partCategoriesData && partCategoriesData.length > 0 && (
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
        <RichTextEditor
          content={formData.comment || ''}
          onChange={(html) => handleChange('comment', html)}
          placeholder="Notes ou commentaires..."
          fetchMentions={() => []}
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
