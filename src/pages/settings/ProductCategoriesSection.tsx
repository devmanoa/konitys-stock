import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Loader2, Hash, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import type { PartType, ProductCategory } from '../../types';
import { PART_TYPE_LABEL } from '../../types';
import { PART_TYPE_BADGE_CLASS } from './partTypeBadge';

// Normalise le code au fur et a mesure de la saisie (majuscules, sans
// accents ni espaces) — miroir de la normalisation serveur pour un
// feedback immediat a l'utilisateur.
const normalizeCodeLive = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-');

/**
 * Section "Catégories principales" de la page Paramètres — la catégorie
 * principale d'un produit, dont le code sert de préfixe de référence
 * (ex : IMPR-DNP-DS620).
 */
export default function ProductCategoriesSection() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [productCategoryModalOpen, setProductCategoryModalOpen] = useState(false);
  const [editingProductCategory, setEditingProductCategory] = useState<ProductCategory | null>(null);
  const [pcName, setPcName] = useState('');
  const [pcCode, setPcCode] = useState('');
  const [pcDescription, setPcDescription] = useState('');
  const [pcIsActive, setPcIsActive] = useState(true);
  const [pcDisplayOrder, setPcDisplayOrder] = useState(0);
  const [pcPartType, setPcPartType] = useState<PartType | ''>('');
  const [deleteProductCategoryConfirm, setDeleteProductCategoryConfirm] =
    useState<ProductCategory | null>(null);

  const { data: productCategoriesData, isLoading: productCategoriesLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ProductCategory[] }>(
        '/product-categories',
      );
      return res.data?.data || [];
    },
  });

  const invalidateProductCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['product-categories'] });
  };

  const productCategoryPayload = () => ({
    name: pcName,
    codeReference: pcCode,
    description: pcDescription || null,
    isActive: pcIsActive,
    displayOrder: Number(pcDisplayOrder) || 0,
    partType: pcPartType || null,
  });

  const resetProductCategoryForm = () => {
    setEditingProductCategory(null);
    setPcName('');
    setPcCode('');
    setPcDescription('');
    setPcIsActive(true);
    setPcDisplayOrder(0);
    setPcPartType('');
  };

  const openProductCategoryModal = (cat?: ProductCategory) => {
    if (cat) {
      setEditingProductCategory(cat);
      setPcName(cat.name);
      setPcCode(cat.codeReference);
      setPcDescription(cat.description || '');
      setPcIsActive(cat.isActive);
      setPcDisplayOrder(cat.displayOrder);
      setPcPartType(cat.partType || '');
    } else {
      resetProductCategoryForm();
    }
    setProductCategoryModalOpen(true);
  };

  const closeProductCategoryModal = () => {
    setProductCategoryModalOpen(false);
    resetProductCategoryForm();
  };

  const createProductCategoryMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: ProductCategory }>(
        '/product-categories',
        productCategoryPayload(),
      );
      return res.data.data;
    },
    onSuccess: () => {
      invalidateProductCategories();
      closeProductCategoryModal();
      toast.success('Catégorie créée', 'La catégorie principale a été créée');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error('Erreur', err.response?.data?.error || 'Impossible de créer la catégorie');
    },
  });

  const updateProductCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!editingProductCategory) throw new Error('no target');
      const res = await api.put<{ success: boolean; data: ProductCategory }>(
        `/product-categories/${editingProductCategory.id}`,
        productCategoryPayload(),
      );
      return res.data.data;
    },
    onSuccess: () => {
      invalidateProductCategories();
      closeProductCategoryModal();
      toast.success('Catégorie modifiée', 'La catégorie principale a été mise à jour');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error('Erreur', err.response?.data?.error || 'Impossible de modifier la catégorie');
    },
  });

  const deleteProductCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/product-categories/${id}`);
    },
    onSuccess: () => {
      invalidateProductCategories();
      setDeleteProductCategoryConfirm(null);
      toast.success('Catégorie supprimée', 'La catégorie principale a été supprimée');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error('Erreur', err.response?.data?.error || 'Impossible de supprimer la catégorie');
    },
  });

  return (
    <>
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">
              Catégories principales
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => openProductCategoryModal()}
            data-perm="stock:product_categories.create"
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
        <div className="p-4">
          <p className="text-sm text-[--k-muted] mb-4">
            Catégorie principale d'un produit (Imprimante, PC, Écran, Câble, …).
            Le <b>code référence</b> sert de préfixe pour générer automatiquement les références
            internes (ex : <code>IMPR-DNP-DS620</code>).
          </p>
          {productCategoriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[--k-primary]" />
            </div>
          ) : !productCategoriesData?.length ? (
            <p className="text-[--k-muted] italic py-4">Aucune catégorie principale créée</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] table-zebra">
                <thead>
                  <tr className="border-b border-[--k-border] bg-[--k-surface-2]/50">
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted] w-16">
                      Ordre
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">
                      Nom
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">
                      Code
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">
                      Description
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted] w-28">
                      Type de pièce
                    </th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium text-[--k-muted] w-20">
                      Actif
                    </th>
                    <th className="px-4 py-1.5 text-right text-xs font-medium text-[--k-muted] w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productCategoriesData.map((cat) => (
                    <tr
                      key={cat.id}
                      className={`border-t border-[--k-border] row-hover ${
                        !cat.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-1.5 tabular-nums text-[--k-muted]">
                        {cat.displayOrder}
                      </td>
                      <td className="px-4 py-1.5 font-medium text-[--k-text]">{cat.name}</td>
                      <td className="px-4 py-1.5 font-mono text-xs">
                        <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-800">
                          {cat.codeReference}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-[--k-muted]">{cat.description || '—'}</td>
                      <td className="px-4 py-1.5">
                        {cat.partType ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PART_TYPE_BADGE_CLASS[cat.partType]}`}
                          >
                            {PART_TYPE_LABEL[cat.partType]}
                          </span>
                        ) : (
                          <span className="text-[--k-muted] italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        {cat.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            <EyeOff className="h-3 w-3" />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProductCategoryModal(cat)}
                            title="Modifier"
                            data-perm="stock:product_categories.edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteProductCategoryConfirm(cat)}
                            title="Supprimer"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            data-perm="stock:product_categories.delete"
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

      {/* Product Category create/edit modal */}
      <Modal
        isOpen={productCategoryModalOpen}
        onClose={closeProductCategoryModal}
        title={editingProductCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie principale'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Nom *"
            value={pcName}
            onChange={(e) => {
              const v = e.target.value;
              setPcName(v);
              // Pre-remplit le code au premier caractere si vide et si on est
              // en creation. L'utilisateur peut toujours l'ecraser.
              if (!editingProductCategory && !pcCode && v.trim()) {
                setPcCode(normalizeCodeLive(v.slice(0, 6)));
              }
            }}
            placeholder="ex : Imprimante"
          />
          <div>
            <Input
              label="Code référence *"
              value={pcCode}
              onChange={(e) => setPcCode(normalizeCodeLive(e.target.value))}
              placeholder="ex : IMPR"
              maxLength={12}
            />
            <p className="mt-1 text-xs text-[--k-muted]">
              Utilisé comme préfixe (ex : <code>IMPR-DNP-DS620</code>). Majuscules, sans accents,
              max 12 caractères.
            </p>
          </div>
          <Input
            label="Description"
            value={pcDescription}
            onChange={(e) => setPcDescription(e.target.value)}
            placeholder="Description optionnelle"
          />
          <div>
            <label className="block text-[13px] font-medium text-[--k-text] mb-1">
              Type de pièce
            </label>
            <select
              value={pcPartType}
              onChange={(e) => setPcPartType(e.target.value as PartType | '')}
              className="input-field w-full text-[13px]"
              style={{ height: '36px' }}
            >
              <option value="">— Non défini —</option>
              <option value="EQUIPMENT">{PART_TYPE_LABEL.EQUIPMENT}</option>
              <option value="PROTECTION">{PART_TYPE_LABEL.PROTECTION}</option>
              <option value="ACCESSORY">{PART_TYPE_LABEL.ACCESSORY}</option>
            </select>
            <p className="mt-1 text-xs text-[--k-muted]">
              Nature du composant (utilisée par Bornes Factory pour grouper la checklist
              d'assemblage). Tous les produits de cette catégorie hériteront de ce type.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[--k-text] mb-1">
                Ordre d'affichage
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPcDisplayOrder((n) => Math.max(0, Number(n) - 1))}
                  title="Diminuer"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  value={pcDisplayOrder}
                  onChange={(e) => setPcDisplayOrder(parseInt(e.target.value) || 0)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPcDisplayOrder((n) => Number(n) + 1)}
                  title="Augmenter"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[--k-text] mb-1">Statut</label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pcIsActive}
                  onChange={(e) => setPcIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-[13px]">
                  {pcIsActive ? 'Actif (disponible)' : 'Inactif (masqué)'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeProductCategoryModal}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                editingProductCategory
                  ? updateProductCategoryMutation.mutate()
                  : createProductCategoryMutation.mutate()
              }
              disabled={
                !pcName.trim() ||
                !pcCode.trim() ||
                createProductCategoryMutation.isPending ||
                updateProductCategoryMutation.isPending
              }
            >
              {createProductCategoryMutation.isPending || updateProductCategoryMutation.isPending
                ? 'Enregistrement…'
                : editingProductCategory
                  ? 'Modifier'
                  : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Product Category confirmation */}
      <Modal
        isOpen={!!deleteProductCategoryConfirm}
        onClose={() => setDeleteProductCategoryConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer la catégorie principale{' '}
            <span className="font-semibold text-[--k-text]">
              {deleteProductCategoryConfirm?.name}
            </span>{' '}
            (code <code>{deleteProductCategoryConfirm?.codeReference}</code>) ?
          </p>
          <p className="text-sm text-[--k-muted]">
            Les produits déjà rattachés à cette catégorie ne seront pas modifiés (leurs
            références restent stables). Ils apparaîtront simplement sans catégorie principale.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteProductCategoryConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                deleteProductCategoryConfirm &&
                deleteProductCategoryMutation.mutate(deleteProductCategoryConfirm.id)
              }
              disabled={deleteProductCategoryMutation.isPending}
            >
              {deleteProductCategoryMutation.isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
