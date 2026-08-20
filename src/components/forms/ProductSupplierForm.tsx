import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SupplierSearch from '../ui/SupplierSearch';
import api from '../../services/api';
import type { Product, Supplier, ProductSupplier, ApiResponse } from '../../types';
import Spinner from '../ui/Spinner'

interface ProductSupplierFormProps {
  product: Product;
  onClose: () => void;
}

interface CreateProductSupplierInput {
  supplierId: string;
  supplierRef?: string;
  unitPrice?: number;
  leadTime?: string;
  productUrl?: string;
  shippingCost?: number;
  isPrimary?: boolean;
}

export default function ProductSupplierForm({ product, onClose }: ProductSupplierFormProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLink, setNewLink] = useState<CreateProductSupplierInput>({
    supplierId: '',
    supplierRef: '',
    unitPrice: undefined,
    leadTime: '',
    productUrl: '',
    shippingCost: undefined,
    isPrimary: false,
  });

  // Fetch product details with suppliers
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', product.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product>>(`/products/${product.id}`);
      return res.data?.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductSupplierInput) => {
      const res = await api.post<ApiResponse<ProductSupplier>>(`/products/${product.id}/suppliers`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-price-history', product.id] });
      queryClient.invalidateQueries({ queryKey: ['product-audit', product.id] });
      setShowAddForm(false);
      setNewLink({
        supplierId: '',
        supplierRef: '',
        unitPrice: undefined,
        leadTime: '',
        productUrl: '',
        shippingCost: undefined,
        isPrimary: false,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      await api.delete(`/products/${product.id}/suppliers/${supplierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-audit', product.id] });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      await api.put(`/products/${product.id}/suppliers/${supplierId}/primary`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.supplierId) return;
    createMutation.mutate(newLink);
  };

  const handleSupplierChange = (supplierId: string, _supplier: Supplier | null) => {
    setNewLink({ ...newLink, supplierId });
  };

  // Get IDs of already linked suppliers to exclude from search
  const linkedSupplierIds = productData?.productSuppliers?.map((ps) => ps.supplierId) || [];

  return (
    <div className="space-y-6">
      {/* Current suppliers */}
      <div>
        <h3 className="mb-3 font-medium text-[--k-text]">Fournisseurs liés</h3>
        {isLoading ? (
          <Spinner size="sm" className="py-4" />
        ) : productData?.productSuppliers?.length === 0 ? (
          <p className="text-[13px] text-[--k-muted]">Aucun fournisseur lié à ce produit.</p>
        ) : (
          <div className="space-y-2">
            {productData?.productSuppliers?.map((ps) => (
              <div
                key={ps.id}
                className="flex items-center justify-between rounded-lg border border-[--k-border] bg-[--k-surface-2] p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[--k-text]">{ps.supplier.name}</span>
                    {ps.isPrimary && (
                      <span className="flex items-center gap-1 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        <Star className="h-3 w-3 fill-current" />
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[--k-muted]">
                    {ps.supplierRef && <span>Réf: {ps.supplierRef}</span>}
                    {ps.unitPrice && (
                      <span>
                        Prix : {Number(ps.unitPrice).toFixed(2)} €
                        {ps.priceUpdatedAt && (
                          <span className="ml-1 text-[11px]">
                            (au {new Date(ps.priceUpdatedAt).toLocaleDateString('fr-FR')})
                          </span>
                        )}
                      </span>
                    )}
                    {ps.leadTime && <span>Délai: {ps.leadTime}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!ps.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryMutation.mutate(ps.supplierId)}
                      title="Définir comme principal"
                      disabled={setPrimaryMutation.isPending}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(ps.supplierId)}
                    title="Supprimer"
                    className="text-[--k-danger] hover:bg-red-50 hover:text-red-700"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new supplier form */}
      {showAddForm ? (
        <form onSubmit={handleSubmit} className="rounded-lg border border-[--k-border] p-4">
          <h4 className="mb-3 font-medium text-[--k-text]">Ajouter un fournisseur</h4>
          <div className="space-y-3">
            <SupplierSearch
              onChange={handleSupplierChange}
              label="Fournisseur *"
              excludeIds={linkedSupplierIds}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                  Référence fournisseur
                </label>
                <Input
                  value={newLink.supplierRef || ''}
                  onChange={(e) => setNewLink({ ...newLink, supplierRef: e.target.value })}
                  placeholder="Ref. fournisseur"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                  Prix unitaire HT
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newLink.unitPrice || ''}
                  onChange={(e) => setNewLink({ ...newLink, unitPrice: parseFloat(e.target.value) || undefined })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                  Délai de livraison
                </label>
                <Input
                  value={newLink.leadTime || ''}
                  onChange={(e) => setNewLink({ ...newLink, leadTime: e.target.value })}
                  placeholder="Ex: 2-3 semaines"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                  Frais de livraison
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newLink.shippingCost || ''}
                  onChange={(e) => setNewLink({ ...newLink, shippingCost: parseFloat(e.target.value) || undefined })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
                URL produit
              </label>
              <Input
                value={newLink.productUrl || ''}
                onChange={(e) => setNewLink({ ...newLink, productUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={newLink.isPrimary || false}
                onChange={(e) => setNewLink({ ...newLink, isPrimary: e.target.checked })}
                className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
              />
              <label htmlFor="isPrimary" className="text-[13px] text-[--k-text]">
                Fournisseur principal
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newLink.supplierId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un fournisseur
        </Button>
      )}

      {/* Close button */}
      <div className="flex justify-end border-t border-[--k-border] pt-4">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}
