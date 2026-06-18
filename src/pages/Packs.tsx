import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, PackageOpen, Search, Package } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ui/Toast';
import ProductSearch from '../components/ui/ProductSearch';
import RichTextEditor from '../components/ui/RichTextEditor';
import { stripHtml } from '../components/ui/RichTextDisplay';
import api from '../services/api';
import type { Pack, Product, ApiResponse } from '../types';

export default function Packs() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<Pack | undefined>();
  const [packName, setPackName] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [packItems, setPackItems] = useState<{ key: string; productId: string; product: { id: string; reference: string; description?: string; imageUrl?: string } | null; quantity: number }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<Pack | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch packs
  const { data: packsData, isLoading } = useQuery({
    queryKey: ['packs'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Pack[]>>('/packs');
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; items: { productId: string; quantity: number }[] }) => {
      await api.post('/packs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'], refetchType: 'all' });
      handleCloseModal();
      toast.success('Pack de pièces créé', 'Le pack de pièces a été créé avec succès');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de créer le pack de pièces');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; items?: { productId: string; quantity: number }[] } }) => {
      await api.put(`/packs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'], refetchType: 'all' });
      handleCloseModal();
      toast.success('Pack de pièces modifié', 'Le pack de pièces a été mis à jour');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de modifier le pack de pièces');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/packs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs'], refetchType: 'all' });
      setDeleteConfirm(null);
      toast.success('Pack de pièces supprimé', 'Le pack de pièces a été supprimé');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le pack de pièces');
    },
  });

  // Handlers
  const handleOpenModal = (pack?: Pack) => {
    setSelectedPack(pack);
    setPackName(pack?.name || '');
    setPackDescription(pack?.description || '');
    setPackItems(pack?.items?.map((item, idx) => ({
      key: `existing-${item.id}-${idx}`,
      productId: item.productId,
      product: item.product,
      quantity: item.quantity,
    })) || []);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPack(undefined);
    setPackName('');
    setPackDescription('');
    setPackItems([]);
  };

  const handleAddItem = () => {
    setPackItems(prev => [...prev, { key: `new-${Date.now()}-${Math.random()}`, productId: '', product: null, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setPackItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemProductChange = (index: number, productId: string, product: Product | null) => {
    setPackItems(prev => prev.map((item, i) =>
      i === index
        ? {
            ...item,
            productId,
            product: product ? { id: product.id, reference: product.reference, description: product.description, imageUrl: product.imageUrl } : null
          }
        : item
    ));
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    setPackItems(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity } : item
    ));
  };

  const handleSave = () => {
    const validItems = packItems.filter(item => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Erreur', 'Ajoutez au moins un produit au pack de pièces');
      return;
    }

    const data = {
      name: packName,
      description: packDescription || undefined,
      items: validItems.map(item => ({ productId: item.productId, quantity: item.quantity })),
    };

    if (selectedPack) {
      updateMutation.mutate({ id: selectedPack.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter packs
  const filteredPacks = packsData?.data?.filter(pack =>
    pack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stripHtml(pack.description).toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Packs de pièces" subtitle="Groupes de produits pour entrées/sorties rapides">
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau pack de pièces
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] py-4 px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="Rechercher un pack de pièces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Packs List */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2 text-lg font-semibold text-[--k-text]">
            <PackageOpen className="h-5 w-5" />
            Liste des packs de commande
          </div>
          <div className="text-xs text-[--k-muted]">{filteredPacks.length} pack{filteredPacks.length > 1 ? 's' : ''} de commande</div>
        </div>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            </div>
          ) : filteredPacks.length === 0 ? (
            <div className="py-8 text-center">
              <PackageOpen className="mx-auto h-12 w-12 text-[--k-muted]" />
              <p className="mt-2 text-[--k-muted]">
                {searchTerm ? 'Aucun pack de pièces trouvé' : 'Aucun pack de pièces créé'}
              </p>
              {!searchTerm && (
                <Button className="mt-4" onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un pack de pièces
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 p-4 lg:hidden">
                {filteredPacks.map((pack) => (
                  <div
                    key={pack.id}
                    className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2 bg-[--k-primary-2] text-[--k-primary]">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[--k-text]">{pack.name}</h3>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenModal(pack)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(pack)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {pack.description && (
                      <p className="mt-2 text-sm text-[--k-muted] line-clamp-2">
                        {stripHtml(pack.description)}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-[--k-border]">
                      <span className="inline-flex items-center rounded-full bg-[--k-surface-2] px-2.5 py-1 text-xs font-medium text-[--k-text]">
                        {pack.items?.length || pack._count?.items || 0} produit{(pack.items?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[--k-surface-2]/50 text-[--k-muted]">
                      <th className="px-4 py-1.5 text-left text-xs font-medium">Nom</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium">Description</th>
                      <th className="px-4 py-1.5 text-center text-xs font-medium">Produits</th>
                      <th className="px-4 py-1.5 text-right text-xs font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPacks.map((pack) => (
                      <tr key={pack.id} className="border-t border-[--k-border] row-hover transition-colors">
                        <td className="px-4 py-1.5">
                          <div className="font-medium text-[--k-text]">
                            {pack.name}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted] max-w-xs truncate">
                          {stripHtml(pack.description) || '-'}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span className="inline-flex items-center rounded-full bg-[--k-surface-2] px-2.5 py-1 text-xs font-medium text-[--k-text]">
                            {pack.items?.length || pack._count?.items || 0} produit{(pack.items?.length || 0) > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenModal(pack)}
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(pack)}
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

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
                <span>{filteredPacks.length} résultat{filteredPacks.length > 1 ? 's' : ''}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedPack ? 'Modifier le pack de pièces' : 'Nouveau pack de pièces'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom du pack de pièces"
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
            placeholder="ex: Tête Spherik, Kit Écran"
          />

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">
              Description
            </label>
            <RichTextEditor
              content={packDescription}
              onChange={setPackDescription}
              placeholder="Description optionnelle..."
              fetchMentions={() => []}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-[--k-text]">
                Produits
              </label>
              <Button size="sm" variant="secondary" onClick={handleAddItem}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter un produit
              </Button>
            </div>

            {packItems.length === 0 ? (
              <p className="text-sm text-[--k-muted] italic py-4 text-center border border-dashed border-[--k-border] rounded-lg">
                Aucun produit ajouté. Cliquez sur "Ajouter" pour commencer.
              </p>
            ) : (
              <div className="space-y-3">
                {packItems.map((item, index) => (
                  <div key={item.key} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 bg-[--k-surface-2] rounded-lg">
                    <div className="flex-1">
                      <ProductSearch
                        label=""
                        onChange={(productId, product) => handleItemProductChange(index, productId, product)}
                        initialProduct={item.product as Product | null}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-24">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQuantityChange(index, parseInt(e.target.value) || 1)}
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
              disabled={!packName || packItems.length === 0 || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Enregistrement...'
                : selectedPack
                ? 'Modifier'
                : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le pack de pièces{' '}
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
