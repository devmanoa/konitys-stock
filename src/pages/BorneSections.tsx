import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Layers } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { ApiResponse, BorneSection } from '../types';

export default function BorneSections() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<BorneSection | undefined>();
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<BorneSection | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['borne-sections'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BorneSection[]>>('/borne-sections');
      return res.data?.data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['borne-sections'] });
    queryClient.invalidateQueries({ queryKey: ['assembly-types'] });
    queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      await api.post('/borne-sections', payload);
    },
    onSuccess: () => {
      invalidate();
      handleCloseModal();
      toast.success('Section créée', 'La section a été créée');
    },
    onError: () => toast.error('Erreur', 'Impossible de créer la section'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { name: string } }) => {
      await api.put(`/borne-sections/${id}`, payload);
    },
    onSuccess: () => {
      invalidate();
      handleCloseModal();
      toast.success('Section modifiée', 'La section a été mise à jour');
    },
    onError: () => toast.error('Erreur', 'Impossible de modifier la section'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/borne-sections/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setDeleteConfirm(null);
      toast.success('Section supprimée', 'La section a été supprimée');
    },
    onError: () => toast.error('Erreur', 'Impossible de supprimer la section'),
  });

  const handleOpenModal = (section?: BorneSection) => {
    setSelected(section);
    setName(section?.name || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelected(undefined);
    setName('');
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Erreur', 'Le nom est requis');
      return;
    }
    const payload = { name: name.trim() };
    if (selected) {
      updateMutation.mutate({ id: selected.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered =
    data?.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sections de borne"
        subtitle="Catégories utilisées pour regrouper les composants d'une borne (ex. Tête, Pied)"
      >
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle section
        </Button>
      </PageHeader>

      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] py-4 px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="Rechercher une section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2 text-lg font-semibold text-[--k-text]">
            <Layers className="h-5 w-5" />
            Sections
          </div>
          <div className="text-xs text-[--k-muted]">
            {filtered.length} section{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Layers className="mx-auto h-12 w-12 text-[--k-muted]" />
              <p className="mt-2 text-[--k-muted]">
                {searchTerm ? 'Aucune section trouvée' : 'Aucune section définie'}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une section
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[--k-surface-2]/50 text-[--k-muted]">
                    <th className="px-4 py-1.5 text-left text-xs font-medium">Nom</th>
                    <th className="px-4 py-1.5 text-right text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((section) => (
                    <tr
                      key={section.id}
                      className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                    >
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2 font-medium text-[--k-text]">
                          <Layers className="h-4 w-4 text-[--k-primary]" />
                          {section.name}
                        </div>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(section)} title="Modifier">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(section)}
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
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selected ? 'Modifier la section' : 'Nouvelle section'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nom de la section"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Tête, Pied, Électronique"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Enregistrement...'
                : selected
                ? 'Modifier'
                : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer la section{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.name}</span> ?
          </p>
          <p className="text-xs text-[--k-muted]">
            Les composants qui utilisent cette section garderont leur référence vide.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
