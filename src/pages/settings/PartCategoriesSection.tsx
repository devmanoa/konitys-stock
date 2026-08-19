import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Layers } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import type { PartCategory } from '../../types';

/**
 * Section "Catégories de pièces" de la page Paramètres — catégories globales
 * partagées entre tous les types de bornes (ex : Tête, Pied, Électronique).
 */
export default function PartCategoriesSection() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<PartCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<PartCategory | null>(null);

  const { data: partCategoriesData } = useQuery({
    queryKey: ['part-categories'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PartCategory[] }>('/part-categories');
      return res.data?.data || [];
    },
  });

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

  return (
    <>
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
    </>
  );
}
