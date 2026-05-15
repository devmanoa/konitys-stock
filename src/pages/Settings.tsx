import { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Boxes, Tag, X, Layers } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PageHeader } from '../components/PageHeader';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ProductSearch from '../components/ui/ProductSearch';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { AssemblyType, Assembly, PartCategory, PaginatedResponse, Product } from '../types';

type AssemblyTypeItemDraft = {
  key: string;
  productId: string;
  product: { id: string; reference: string; description?: string; imageUrl?: string } | null;
  quantity: number;
  partCategoryId: string;
};

function summarizeAssemblyTypeItems(items: AssemblyType['items']) {
  const list = items || [];
  let total = 0;
  const buckets = new Map<string, number>();
  for (const it of list) {
    const qty = Number(it.quantity) || 0;
    total += qty;
    const label = it.partCategory?.name || 'Sans catégorie';
    buckets.set(label, (buckets.get(label) || 0) + qty);
  }
  const byCategory = Array.from(buckets.entries())
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty);
  return { total, byCategory };
}

export default function Settings() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Assembly Types state (ex: Borne Classik, Borne Spherik)
  const [isAssemblyTypeModalOpen, setIsAssemblyTypeModalOpen] = useState(false);
  const [selectedAssemblyType, setSelectedAssemblyType] = useState<AssemblyType | undefined>();
  const [assemblyTypeName, setAssemblyTypeName] = useState('');
  const [assemblyTypeDescription, setAssemblyTypeDescription] = useState('');
  const [assemblyTypeItems, setAssemblyTypeItems] = useState<AssemblyTypeItemDraft[]>([]);
  const [deleteAssemblyTypeConfirm, setDeleteAssemblyTypeConfirm] = useState<AssemblyType | null>(null);



  // Part Categories state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<PartCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<PartCategory | null>(null);

  // Assemblies state (ex: Ossature, Face Avant, Écran)
  const [isAssemblyModalOpen, setIsAssemblyModalOpen] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | undefined>();
  const [assemblyName, setAssemblyName] = useState('');
  const [assemblyDescription, setAssemblyDescription] = useState('');
  const [assemblyTypeIds, setAssemblyTypeIds] = useState<string[]>([]);
  const [deleteAssemblyConfirm, setDeleteAssemblyConfirm] = useState<Assembly | null>(null);


  // Fetch assembly types
  const { data: assemblyTypesData, isLoading: assemblyTypesLoading } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<AssemblyType>>('/assembly-types?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch assemblies
  const { data: assembliesData, isLoading: assembliesLoading } = useQuery({
    queryKey: ['assemblies'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Assembly>>('/assemblies?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch part categories (global)
  const { data: partCategoriesData } = useQuery({
    queryKey: ['part-categories'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PartCategory[] }>('/part-categories');
      return res.data?.data || [];
    },
  });

  // Assembly Type mutations
  type AssemblyTypePayload = {
    name: string;
    description?: string;
    items?: { productId: string; quantity: number; partCategoryId?: string | null }[];
  };

  const invalidateBuildable = () => {
    queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
  };

  const createAssemblyTypeMutation = useMutation({
    mutationFn: async (data: AssemblyTypePayload) => {
      await api.post('/assembly-types', data);
    },
    onSuccess: () => {
      invalidateBuildable();
      handleCloseAssemblyTypeModal();
      toast.success('Type borne créé', 'Le type borne a été créé avec succès');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de créer le type borne');
    },
  });

  const updateAssemblyTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssemblyTypePayload }) => {
      await api.put(`/assembly-types/${id}`, data);
    },
    onSuccess: () => {
      invalidateBuildable();
      handleCloseAssemblyTypeModal();
      toast.success('Type borne modifié', 'Le type borne a été mis à jour');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de modifier le type borne');
    },
  });

  const deleteAssemblyTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assembly-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assemblies'], refetchType: 'all' });
      setDeleteAssemblyTypeConfirm(null);
      toast.success('Type borne supprimé', 'Le type borne a été supprimé');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le type borne');
    },
  });

  // Assembly mutations
  const createAssemblyMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; assemblyTypeIds?: string[] }) => {
      await api.post('/assemblies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assemblies'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
      handleCloseAssemblyModal();
      toast.success('Borne créée', 'La borne a été créée avec succès');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de créer la borne');
    },
  });

  const updateAssemblyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string; assemblyTypeIds?: string[] } }) => {
      await api.put(`/assemblies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assemblies'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
      handleCloseAssemblyModal();
      toast.success('Borne modifiée', 'La borne a été mise à jour');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de modifier la borne');
    },
  });

  const deleteAssemblyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assemblies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assemblies'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
      setDeleteAssemblyConfirm(null);
      toast.success('Borne supprimée', 'La borne a été supprimée');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer la borne');
    },
  });


  // Part Category mutations (global, no longer scoped per assembly type)
  const invalidatePartCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['part-categories'] });
    queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
  };

  const createPartCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/part-categories', { name });
    },
    onSuccess: () => {
      invalidatePartCategories();
      setNewCategoryName('');
      toast.success('Catégorie créée', 'La catégorie de pièces a été créée');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de créer la catégorie');
    },
  });

  const updatePartCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.put(`/part-categories/${id}`, { name });
    },
    onSuccess: () => {
      invalidatePartCategories();
      setEditingCategory(null);
      setEditCategoryName('');
      toast.success('Catégorie modifiée', 'La catégorie a été renommée');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de modifier la catégorie');
    },
  });

  const deletePartCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/part-categories/${id}`);
    },
    onSuccess: () => {
      invalidatePartCategories();
      setDeleteCategoryConfirm(null);
      toast.success('Catégorie supprimée', 'La catégorie a été supprimée');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer la catégorie');
    },
  });

  // Assembly Type handlers
  const handleOpenAssemblyTypeModal = (assemblyType?: AssemblyType) => {
    setSelectedAssemblyType(assemblyType);
    setAssemblyTypeName(assemblyType?.name || '');
    setAssemblyTypeDescription(assemblyType?.description || '');
    setAssemblyTypeItems(
      assemblyType?.items?.map((item, idx) => ({
        key: `existing-${item.id}-${idx}`,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        partCategoryId: item.partCategoryId || '',
      })) || []
    );
    setIsAssemblyTypeModalOpen(true);
  };

  const handleCloseAssemblyTypeModal = () => {
    setIsAssemblyTypeModalOpen(false);
    setSelectedAssemblyType(undefined);
    setAssemblyTypeName('');
    setAssemblyTypeDescription('');
    setAssemblyTypeItems([]);
  };

  const handleAddAssemblyTypeItem = () => {
    setAssemblyTypeItems((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random()}`, productId: '', product: null, quantity: 1, partCategoryId: '' },
    ]);
  };

  const handleRemoveAssemblyTypeItem = (index: number) => {
    setAssemblyTypeItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAssemblyTypeItemProductChange = (index: number, productId: string, product: Product | null) => {
    setAssemblyTypeItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId,
              product: product
                ? { id: product.id, reference: product.reference, description: product.description, imageUrl: product.imageUrl }
                : null,
            }
          : item
      )
    );
  };

  const handleAssemblyTypeItemFieldChange = (
    index: number,
    field: 'quantity' | 'partCategoryId',
    value: number | string,
  ) => {
    setAssemblyTypeItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSaveAssemblyType = () => {
    const validItems = assemblyTypeItems.filter((it) => it.productId && it.quantity > 0);
    const data: AssemblyTypePayload = {
      name: assemblyTypeName,
      description: assemblyTypeDescription || undefined,
      items: validItems.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        partCategoryId: it.partCategoryId || null,
      })),
    };

    if (selectedAssemblyType) {
      updateAssemblyTypeMutation.mutate({ id: selectedAssemblyType.id, data });
    } else {
      createAssemblyTypeMutation.mutate(data);
    }
  };

  // Assembly handlers
  const handleOpenAssemblyModal = (assembly?: Assembly) => {
    setSelectedAssembly(assembly);
    setAssemblyName(assembly?.name || '');
    setAssemblyDescription(assembly?.description || '');
    setAssemblyTypeIds(assembly?.assemblyTypes?.map(at => at.id) || []);
    setIsAssemblyModalOpen(true);
  };

  const handleCloseAssemblyModal = () => {
    setIsAssemblyModalOpen(false);
    setSelectedAssembly(undefined);
    setAssemblyName('');
    setAssemblyDescription('');
    setAssemblyTypeIds([]);
  };

  const handleToggleAssemblyType = (typeId: string) => {
    setAssemblyTypeIds(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleSaveAssembly = () => {
    const data = {
      name: assemblyName,
      description: assemblyDescription || undefined,
      assemblyTypeIds: assemblyTypeIds.length > 0 ? assemblyTypeIds : undefined,
    };

    if (selectedAssembly) {
      updateAssemblyMutation.mutate({ id: selectedAssembly.id, data });
    } else {
      createAssemblyMutation.mutate(data);
    }
  };



  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Configuration des types de bornes et bornes" />

      {/* Types de bornes */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Types de bornes</span>
          </div>
          <Button size="sm" onClick={() => handleOpenAssemblyTypeModal()}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
        <div className="p-4">
          <p className="text-sm text-[--k-muted] mb-4">
            Les types de bornes représentent les familles de bornes (ex: Borne Classik, Borne Spherik). Une borne peut appartenir à plusieurs types.
          </p>
          {assemblyTypesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            </div>
          ) : !assemblyTypesData?.length ? (
            <p className="text-[--k-muted] italic py-4">
              Aucun type borne créé
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 lg:hidden">
                {assemblyTypesData.map((assemblyType) => {
                  const totals = summarizeAssemblyTypeItems(assemblyType.items)
                  return (
                  <div
                    key={assemblyType.id}
                    className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[--k-text]">{assemblyType.name}</h3>
                        {assemblyType.description && (
                          <p className="mt-1 text-sm text-[--k-muted] line-clamp-2">
                            {assemblyType.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-[--k-muted]">
                          {assemblyType._count?.assemblies || 0} borne(s) · Total pièces : <span className="font-semibold text-[--k-text]">{totals.total}</span>
                        </p>
                        {totals.byCategory.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {totals.byCategory.map((c) => (
                              <span
                                key={c.label}
                                className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                              >
                                {c.label} : {c.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAssemblyTypeModal(assemblyType)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteAssemblyTypeConfirm(assemblyType)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[--k-border] bg-[--k-surface-2]/50">
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Nom</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Description</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Composition</th>
                      <th className="px-4 py-1.5 text-center text-xs font-medium text-[--k-muted]">Bornes</th>
                      <th className="px-4 py-1.5 text-right text-xs font-medium text-[--k-muted]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assemblyTypesData.map((assemblyType) => {
                      const totals = summarizeAssemblyTypeItems(assemblyType.items)
                      return (
                      <tr key={assemblyType.id} className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors">
                        <td className="px-4 py-1.5 font-medium text-[--k-text]">
                          {assemblyType.name}
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {assemblyType.description || '-'}
                        </td>
                        <td className="px-4 py-1.5">
                          {totals.total === 0 ? (
                            <span className="text-[--k-muted]">—</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] text-[--k-text]">
                                Total pièces : <span className="font-semibold">{totals.total}</span>
                              </span>
                              {totals.byCategory.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {totals.byCategory.map((c) => (
                                    <span
                                      key={c.label}
                                      className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                                    >
                                      {c.label} : {c.qty}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-center text-[--k-muted]">
                          {assemblyType._count?.assemblies || 0}
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAssemblyTypeModal(assemblyType)}
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteAssemblyTypeConfirm(assemblyType)}
                              title="Supprimer"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Catégories de pièces — globales */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Catégories de pièces</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-[--k-muted] mb-4">
            Catégories partagées entre tous les types de bornes pour regrouper les composants (ex: Tête, Pied, Électronique).
          </p>
          {partCategoriesData && partCategoriesData.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {partCategoriesData.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 pl-3 pr-1.5 py-1 text-xs font-medium text-indigo-800"
                >
                  {editingCategory?.id === cat.id ? (
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editCategoryName.trim()) {
                          updatePartCategoryMutation.mutate({ id: cat.id, name: editCategoryName.trim() });
                        }
                        if (e.key === 'Escape') {
                          setEditingCategory(null);
                          setEditCategoryName('');
                        }
                      }}
                      onBlur={() => {
                        if (editCategoryName.trim() && editCategoryName !== cat.name) {
                          updatePartCategoryMutation.mutate({ id: cat.id, name: editCategoryName.trim() });
                        } else {
                          setEditingCategory(null);
                          setEditCategoryName('');
                        }
                      }}
                      className="bg-transparent border-none outline-none w-20 text-xs"
                      autoFocus
                    />
                  ) : (
                    <>
                      {cat.name}
                      {cat._count?.products != null && (
                        <span className="text-indigo-500">({cat._count.products})</span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(cat);
                      setEditCategoryName(cat.name);
                    }}
                    className="hover:text-indigo-600 p-0.5"
                    title="Renommer"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteCategoryConfirm(cat)}
                    className="hover:text-red-600 p-0.5"
                    title="Supprimer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[--k-muted] italic mb-3">Aucune catégorie</p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  createPartCategoryMutation.mutate(newCategoryName.trim());
                }
              }}
              placeholder="Nouvelle catégorie..."
              className="input-field text-xs"
              style={{ height: '28px', padding: '0 0.5rem', maxWidth: '200px' }}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (newCategoryName.trim()) {
                  createPartCategoryMutation.mutate(newCategoryName.trim());
                }
              }}
              disabled={!newCategoryName.trim() || createPartCategoryMutation.isPending}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      </div>

      {/* Bornes — masqué temporairement */}
      {false && (
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Bornes</span>
          </div>
          <Button size="sm" onClick={() => handleOpenAssemblyModal()}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
        <div className="p-4">
          <p className="text-sm text-[--k-muted] mb-4">
            Les bornes catégorisent les composants (ex: Ossature, Face Avant, Écran). Chaque borne peut être liée à plusieurs types de bornes.
          </p>
          {assembliesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            </div>
          ) : !assembliesData?.length ? (
            <p className="text-[--k-muted] italic py-4">
              Aucune borne créée
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 lg:hidden">
                {(assembliesData ?? []).map((assembly) => (
                  <div
                    key={assembly.id}
                    className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[--k-text]">{assembly.name}</h3>
                        {assembly.description && (
                          <p className="mt-1 text-sm text-[--k-muted] line-clamp-2">
                            {assembly.description}
                          </p>
                        )}
                        {assembly.assemblyTypes?.length ? (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {assembly.assemblyTypes.map((type) => (
                              <span
                                key={type.id}
                                className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
                              >
                                {type.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-[--k-muted]">
                          {assembly._count?.products || 0} produit(s)
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAssemblyModal(assembly)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteAssemblyConfirm(assembly)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[--k-border] bg-[--k-surface-2]/50">
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Nom</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Description</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Types de bornes</th>
                      <th className="px-4 py-1.5 text-center text-xs font-medium text-[--k-muted]">Produits</th>
                      <th className="px-4 py-1.5 text-right text-xs font-medium text-[--k-muted]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(assembliesData ?? []).map((assembly) => (
                      <tr key={assembly.id} className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors">
                        <td className="px-4 py-1.5 font-medium text-[--k-text]">
                          {assembly.name}
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {assembly.description || '-'}
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {assembly.assemblyTypes?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {assembly.assemblyTypes.map((type) => (
                                <span
                                  key={type.id}
                                  className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
                                >
                                  {type.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-[--k-muted]">Aucun type</span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-center text-[--k-muted]">
                          {assembly._count?.products || 0}
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAssemblyModal(assembly)}
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteAssemblyConfirm(assembly)}
                              title="Supprimer"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Assembly Type Modal */}
      <Modal
        isOpen={isAssemblyTypeModalOpen}
        onClose={handleCloseAssemblyTypeModal}
        title={selectedAssemblyType ? 'Modifier le type borne' : 'Nouveau type borne'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={assemblyTypeName}
            onChange={(e) => setAssemblyTypeName(e.target.value)}
            placeholder="ex: Borne Classik"
          />
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">
              Description
            </label>
            <textarea
              value={assemblyTypeDescription}
              onChange={(e) => setAssemblyTypeDescription(e.target.value)}
              placeholder="Description optionnelle..."
              rows={3}
              className="input-field"
              style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-[--k-text]">
                Composants nécessaires pour la construction
              </label>
              <Button size="sm" variant="secondary" onClick={handleAddAssemblyTypeItem}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
            <p className="text-xs text-[--k-muted]">
              Liste des pièces et quantités nécessaires pour construire une unité de ce type de borne.
            </p>

            {assemblyTypeItems.length === 0 ? (
              <p className="text-sm text-[--k-muted] italic py-4 text-center border border-dashed border-[--k-border] rounded-lg">
                Aucun composant. Cliquez sur "Ajouter" pour commencer.
              </p>
            ) : (
              <div className="space-y-3">
                {assemblyTypeItems.map((item, index) => (
                  <div
                    key={item.key}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 bg-[--k-surface-2] rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <ProductSearch
                        label=""
                        onChange={(productId, product) => handleAssemblyTypeItemProductChange(index, productId, product)}
                        initialProduct={item.product as Product | null}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-36">
                        <Select
                          value={item.partCategoryId}
                          onChange={(e) => handleAssemblyTypeItemFieldChange(index, 'partCategoryId', e.target.value)}
                          disabled={!partCategoriesData?.length}
                        >
                          <option value="">— Catégorie —</option>
                          {(partCategoriesData || []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="w-20 sm:w-24">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleAssemblyTypeItemFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Qté"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAssemblyTypeItem(index)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseAssemblyTypeModal}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveAssemblyType}
              disabled={!assemblyTypeName || createAssemblyTypeMutation.isPending || updateAssemblyTypeMutation.isPending}
            >
              {createAssemblyTypeMutation.isPending || updateAssemblyTypeMutation.isPending
                ? 'Enregistrement...'
                : selectedAssemblyType
                ? 'Modifier'
                : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assembly Modal */}
      <Modal
        isOpen={isAssemblyModalOpen}
        onClose={handleCloseAssemblyModal}
        title={selectedAssembly ? 'Modifier la borne' : 'Nouvelle borne'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nom"
            value={assemblyName}
            onChange={(e) => setAssemblyName(e.target.value)}
            placeholder="ex: Ossature, Face Avant, Écran"
          />
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">
              Types de bornes associés
            </label>
            <p className="text-xs text-[--k-muted] mb-2">
              Sélectionnez un ou plusieurs types de bornes
            </p>
            {assemblyTypesData?.length ? (
              <div className="space-y-2">
                {/* Selected types */}
                {assemblyTypeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {assemblyTypeIds.map((typeId) => {
                      const type = assemblyTypesData.find(t => t.id === typeId);
                      return type ? (
                        <span
                          key={type.id}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800"
                        >
                          {type.name}
                          <button
                            type="button"
                            onClick={() => handleToggleAssemblyType(type.id)}
                            className="ml-1 hover:text-[--k-primary]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Available types to add */}
                <div className="flex flex-wrap gap-2 border border-[--k-border] rounded-lg p-3">
                  {assemblyTypesData
                    .filter(type => !assemblyTypeIds.includes(type.id))
                    .map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleToggleAssemblyType(type.id)}
                        className="inline-flex items-center rounded-full border border-[--k-border] bg-[--k-surface] px-3 py-1 text-sm text-[--k-text] hover:bg-[--k-surface-2]"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {type.name}
                      </button>
                    ))}
                  {assemblyTypesData.filter(type => !assemblyTypeIds.includes(type.id)).length === 0 && (
                    <span className="text-sm text-[--k-muted] italic">
                      Tous les types sont sélectionnés
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[--k-muted] italic">
                Aucun type borne disponible. Créez-en d'abord.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">
              Description
            </label>
            <textarea
              value={assemblyDescription}
              onChange={(e) => setAssemblyDescription(e.target.value)}
              placeholder="Description optionnelle..."
              rows={3}
              className="input-field"
              style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseAssemblyModal}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveAssembly}
              disabled={!assemblyName || createAssemblyMutation.isPending || updateAssemblyMutation.isPending}
            >
              {createAssemblyMutation.isPending || updateAssemblyMutation.isPending
                ? 'Enregistrement...'
                : selectedAssembly
                ? 'Modifier'
                : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Assembly Type Confirmation */}
      <Modal
        isOpen={!!deleteAssemblyTypeConfirm}
        onClose={() => setDeleteAssemblyTypeConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le type borne{' '}
            <span className="font-semibold text-[--k-text]">{deleteAssemblyTypeConfirm?.name}</span> ?
          </p>
          <p className="text-sm text-red-600">
            Les bornes liées à ce type ne seront plus associées.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteAssemblyTypeConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteAssemblyTypeConfirm && deleteAssemblyTypeMutation.mutate(deleteAssemblyTypeConfirm.id)}
              disabled={deleteAssemblyTypeMutation.isPending}
            >
              {deleteAssemblyTypeMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Assembly Confirmation */}
      <Modal
        isOpen={!!deleteAssemblyConfirm}
        onClose={() => setDeleteAssemblyConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer la borne{' '}
            <span className="font-semibold text-[--k-text]">{deleteAssemblyConfirm?.name}</span> ?
          </p>
          <p className="text-sm text-red-600">
            Les produits associés ne seront plus liés à cette borne.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteAssemblyConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteAssemblyConfirm && deleteAssemblyMutation.mutate(deleteAssemblyConfirm.id)}
              disabled={deleteAssemblyMutation.isPending}
            >
              {deleteAssemblyMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>



      {/* Delete Part Category Confirmation */}
      <Modal
        isOpen={!!deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer la catégorie{' '}
            <span className="font-semibold text-[--k-text]">{deleteCategoryConfirm?.name}</span> ?
          </p>
          <p className="text-sm text-red-600">
            Les produits associés ne seront plus liés à cette catégorie.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteCategoryConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteCategoryConfirm && deletePartCategoryMutation.mutate(deleteCategoryConfirm.id)}
              disabled={deletePartCategoryMutation.isPending}
            >
              {deletePartCategoryMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
