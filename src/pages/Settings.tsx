import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Tag, X } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PageHeader } from '../components/PageHeader';
import Input from '../components/ui/Input';
import RichTextEditor from '../components/ui/RichTextEditor';
import { stripHtml } from '../components/ui/RichTextDisplay';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { AssemblyType, Assembly, PaginatedResponse } from '../types';
import AssemblyTypesSection from './settings/AssemblyTypesSection';
import ProductCategoriesSection from './settings/ProductCategoriesSection';
import PartCategoriesSection from './settings/PartCategoriesSection';
import Spinner from '../components/ui/Spinner'

/**
 * Page Paramètres. Chaque carte vit dans son propre composant
 * (src/pages/settings/) avec ses queries/mutations/modals. Ne reste ici
 * que la section "Bornes" masquée temporairement ({false && ...}) et ses
 * modals, conservées en l'état en attendant une décision produit.
 */
export default function Settings() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Assemblies state (ex: Ossature, Face Avant, Écran) — section masquée
  const [isAssemblyModalOpen, setIsAssemblyModalOpen] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly | undefined>();
  const [assemblyName, setAssemblyName] = useState('');
  const [assemblyDescription, setAssemblyDescription] = useState('');
  const [assemblyTypeIds, setAssemblyTypeIds] = useState<string[]>([]);
  const [deleteAssemblyConfirm, setDeleteAssemblyConfirm] = useState<Assembly | null>(null);

  // Fetch assembly types (utilisé par le picker du modal Borne)
  const { data: assemblyTypesData } = useQuery({
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

      <AssemblyTypesSection />

      <ProductCategoriesSection />

      <PartCategoriesSection />

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
            <Spinner size="md" className="py-8" />
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
                            {stripHtml(assembly.description)}
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
                <table className="w-full text-[13px] table-zebra">
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
                      <tr key={assembly.id} className="border-t border-[--k-border] row-hover transition-colors">
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
            <RichTextEditor
              content={assemblyDescription}
              onChange={setAssemblyDescription}
              placeholder="Description optionnelle..."
              fetchMentions={() => []}
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
    </div>
  );
}
