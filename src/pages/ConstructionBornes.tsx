import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Wrench, Package } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ui/Toast';
import ProductSearch from '../components/ui/ProductSearch';
import api from '../services/api';
import type {
  ConstructionBorne,
  CreateConstructionBorneInput,
  BorneSection,
  Product,
  ApiResponse,
} from '../types';

type BorneItemDraft = {
  key: string;
  productId: string;
  product: { id: string; reference: string; description?: string; imageUrl?: string } | null;
  quantity: number;
  sectionId: string;
};

export default function ConstructionBornes() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<ConstructionBorne | undefined>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BorneItemDraft[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<ConstructionBorne | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['construction-bornes'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ConstructionBorne[]>>('/construction-bornes');
      return res.data;
    },
  });

  const { data: sectionsData } = useQuery({
    queryKey: ['borne-sections'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BorneSection[]>>('/borne-sections');
      return res.data?.data || [];
    },
  });
  const sections = sectionsData || [];

  const createSectionMutation = useMutation({
    mutationFn: async (sectionName: string) => {
      const res = await api.post<ApiResponse<BorneSection>>('/borne-sections', { name: sectionName });
      return res.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borne-sections'] });
    },
    onError: () => toast.error('Erreur', 'Impossible de créer la section'),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateConstructionBorneInput) => {
      await api.post('/construction-bornes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-bornes'] });
      queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
      handleCloseModal();
      toast.success('Borne créée', 'La borne a été créée avec succès');
    },
    onError: () => toast.error('Erreur', 'Impossible de créer la borne'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: payload }: { id: string; data: Partial<CreateConstructionBorneInput> }) => {
      await api.put(`/construction-bornes/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-bornes'] });
      queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
      handleCloseModal();
      toast.success('Borne modifiée', 'La borne a été mise à jour');
    },
    onError: () => toast.error('Erreur', 'Impossible de modifier la borne'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/construction-bornes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-bornes'] });
      queryClient.invalidateQueries({ queryKey: ['buildable-bornes'] });
      setDeleteConfirm(null);
      toast.success('Borne supprimée', 'La borne a été supprimée');
    },
    onError: () => toast.error('Erreur', 'Impossible de supprimer la borne'),
  });

  const handleOpenModal = (borne?: ConstructionBorne) => {
    setSelected(borne);
    setName(borne?.name || '');
    setDescription(borne?.description || '');
    setItems(
      borne?.items?.map((item, idx) => ({
        key: `existing-${item.id}-${idx}`,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        sectionId: item.sectionId || '',
      })) || []
    );
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelected(undefined);
    setName('');
    setDescription('');
    setItems([]);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random()}`, productId: '', product: null, quantity: 1, sectionId: '' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, productId: string, product: Product | null) => {
    setItems((prev) =>
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

  const handleItemFieldChange = (index: number, field: 'quantity' | 'sectionId', value: number | string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleCreateSectionInline = async (index: number) => {
    const promptName = window.prompt('Nom de la nouvelle section');
    if (!promptName || !promptName.trim()) return;
    try {
      const section = await createSectionMutation.mutateAsync(promptName.trim());
      setItems((prev) => prev.map((item, i) => (i === index ? { ...item, sectionId: section.id } : item)));
    } catch {
      // error toast already shown by mutation
    }
  };

  const handleSave = () => {
    const validItems = items.filter((item) => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Erreur', 'Ajoutez au moins un composant');
      return;
    }

    const payload: CreateConstructionBorneInput = {
      name,
      description: description || null,
      items: validItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        sectionId: item.sectionId || null,
      })),
    };

    if (selected) {
      updateMutation.mutate({ id: selected.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered =
    data?.data?.filter(
      (b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nomenclatures de bornes"
        subtitle="Définition des composants nécessaires à la construction de chaque borne"
      >
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle borne
        </Button>
      </PageHeader>

      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] py-4 px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="Rechercher une borne..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2 text-lg font-semibold text-[--k-text]">
            <Wrench className="h-5 w-5" />
            Bornes définies
          </div>
          <div className="text-xs text-[--k-muted]">
            {filtered.length} borne{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <Wrench className="mx-auto h-12 w-12 text-[--k-muted]" />
              <p className="mt-2 text-[--k-muted]">
                {searchTerm ? 'Aucune borne trouvée' : 'Aucune borne définie'}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une borne
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[--k-surface-2]/50 text-[--k-muted]">
                    <th className="px-4 py-1.5 text-left text-xs font-medium">Nom</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium">Description</th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium">Composants</th>
                    <th className="px-4 py-1.5 text-right text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((borne) => (
                    <tr
                      key={borne.id}
                      className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                    >
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2 font-medium text-[--k-text]">
                          <Package className="h-4 w-4 text-[--k-primary]" />
                          {borne.name}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-[--k-muted] max-w-xs truncate">
                        {borne.description || '-'}
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-[--k-surface-2] px-2.5 py-1 text-xs font-medium text-[--k-text]">
                          {borne.items.length} composant{borne.items.length > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(borne)}
                            title="Modifier"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(borne)}
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
        title={selected ? 'Modifier la borne' : 'Nouvelle borne'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom de la borne"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Borne spherik, Borne classik"
          />

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
              rows={2}
              className="input-field"
              style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-[--k-text]">
                Composants nécessaires
              </label>
              <Button size="sm" variant="secondary" onClick={handleAddItem}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter un composant
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-[--k-muted] italic py-4 text-center border border-dashed border-[--k-border] rounded-lg">
                Aucun composant. Cliquez sur "Ajouter" pour commencer.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.key}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 bg-[--k-surface-2] rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <ProductSearch
                        label=""
                        onChange={(productId, product) => handleItemProductChange(index, productId, product)}
                        initialProduct={item.product as Product | null}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-36 flex gap-1">
                        <Select
                          value={item.sectionId}
                          onChange={(e) => handleItemFieldChange(index, 'sectionId', e.target.value)}
                        >
                          <option value="">— Section —</option>
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          onClick={() => handleCreateSectionInline(index)}
                          title="Créer une nouvelle section"
                          className="flex-shrink-0 rounded-lg border border-[--k-border] bg-[--k-surface] px-2 text-[--k-muted] hover:border-[--k-primary] hover:text-[--k-primary]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="w-20 sm:w-24">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Qté"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
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
            <Button variant="secondary" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name || items.length === 0 || createMutation.isPending || updateMutation.isPending}
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
            Êtes-vous sûr de vouloir supprimer la borne{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.name}</span> ?
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
