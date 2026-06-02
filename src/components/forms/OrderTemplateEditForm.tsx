import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Search, ShoppingCart } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SupplierSearch from '../ui/SupplierSearch';
import RichTextEditor from '../ui/RichTextEditor';
import api from '../../services/api';
import type { OrderTemplate, Supplier, Site, Product, ApiResponse, PaginatedResponse } from '../../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

interface OrderLine {
  productId: string;
  product: {
    id: string;
    reference: string;
    description?: string;
    imageUrl?: string;
  };
  quantity: number;
  unitPrice: string;
}

interface OrderTemplateEditFormProps {
  template?: OrderTemplate;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function OrderTemplateEditForm({ template, onSuccess, onCancel }: OrderTemplateEditFormProps) {
  const isCreating = !template;
  const [name, setName] = useState(template?.name || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState(template?.supplierId || '');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(template?.supplier || null);
  const [destinationSiteId, setDestinationSiteId] = useState(template?.destinationSiteId || '');
  const [responsible, setResponsible] = useState(template?.responsible || '');
  const [comment, setComment] = useState(template?.comment || '');
  const [orderLines, setOrderLines] = useState<OrderLine[]>(
    template?.items?.map((item) => ({
      productId: item.productId,
      product: item.product || { id: item.productId, reference: '' },
      quantity: item.quantity,
      unitPrice: item.unitPrice ? String(Number(item.unitPrice)) : '',
    })) || []
  );

  // Product picker
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Fetch sites
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data;
    },
  });
  const storageSites = sites?.filter(s => s.type === 'STORAGE' && s.isActive) || [];

  // Fetch products for the selected supplier
  const { data: supplierProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'supplier', selectedSupplierId],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Product>>(`/products?supplierId=${selectedSupplierId}&limit=10000`);
      return res.data?.data || [];
    },
    enabled: !!selectedSupplierId,
  });

  // Products available to add
  const availableProducts = useMemo(() => {
    if (!supplierProducts) return [];
    const selectedIds = new Set(orderLines.map(l => l.productId));
    let filtered = supplierProducts.filter(p => !selectedIds.has(p.id));
    if (pickerSearch) {
      const search = pickerSearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.reference.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [supplierProducts, orderLines, pickerSearch]);

  const addProduct = (product: Product) => {
    const ps = product.productSuppliers?.find(ps => ps.supplierId === selectedSupplierId);
    setOrderLines(prev => [...prev, {
      productId: product.id,
      product: {
        id: product.id,
        reference: product.reference,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      quantity: 1,
      unitPrice: ps?.unitPrice ? String(Number(ps.unitPrice)) : '',
    }]);
  };

  const removeProduct = (productId: string) => {
    setOrderLines(prev => prev.filter(l => l.productId !== productId));
  };

  const updateLine = (productId: string, field: 'quantity' | 'unitPrice', value: string) => {
    setOrderLines(prev => prev.map(l =>
      l.productId === productId
        ? { ...l, [field]: field === 'quantity' ? (parseInt(value) || 0) : value }
        : l
    ));
  };

  const totalEstime = useMemo(() => {
    return orderLines.reduce((sum, line) => {
      const price = parseFloat(line.unitPrice) || 0;
      return sum + price * line.quantity;
    }, 0);
  }, [orderLines]);

  const validLines = orderLines.filter(l => l.quantity > 0);

  const handleSupplierChange = (supplierId: string, supplier: Supplier | null) => {
    setSelectedSupplierId(supplierId);
    setSelectedSupplier(supplier);
    if (supplierId !== (template?.supplierId || '')) {
      setOrderLines([]);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = validLines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice ? parseFloat(line.unitPrice) : undefined,
      }));

      const payload: any = {
        name,
        supplierId: selectedSupplierId,
        destinationSiteId: destinationSiteId || null,
        responsible: responsible || null,
        comment: comment || null,
        items,
      };

      if (isCreating) {
        await api.post('/order-templates', payload);
      } else {
        await api.put(`/order-templates/${template.id}`, payload);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedSupplierId || validLines.length === 0) return;
    saveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <Input
        id="templateName"
        label="Nom du modèle *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex : Réappro mensuel composants"
      />

      {/* Supplier */}
      <SupplierSearch
        onChange={handleSupplierChange}
        initialSupplier={selectedSupplier}
      />

      {/* Header fields in grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          id="destinationSiteId"
          label="Site de destination"
          value={destinationSiteId}
          onChange={(e) => setDestinationSiteId(e.target.value)}
        >
          <option value="">Sélectionner</option>
          {storageSites.map(site => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </Select>
        <Input
          id="responsible"
          label="Responsable"
          placeholder="Nom du responsable"
          value={responsible}
          onChange={(e) => setResponsible(e.target.value)}
        />
      </div>

      {/* Articles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-medium text-[--k-text]">
            Articles ({orderLines.length})
          </h4>
          <Button
            type="button"
            size="sm"
            onClick={() => { setPickerSearch(''); setIsPickerOpen(true); }}
            disabled={productsLoading || !selectedSupplierId}
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un produit
          </Button>
        </div>

        {orderLines.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[--k-border] py-8 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-[13px] text-[--k-muted]">
              Aucun produit ajouté
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => { setPickerSearch(''); setIsPickerOpen(true); }}
              disabled={productsLoading || !selectedSupplierId}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un produit
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[--k-border] rounded-xl">
            <table className="w-full text-[13px]">
              <thead className="bg-[--k-surface-2]">
                <tr className="text-left text-xs font-medium uppercase text-[--k-muted]">
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Référence</th>
                  <th className="px-3 py-2">Prix HT</th>
                  <th className="px-3 py-2 w-28">Quantité</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--k-border]">
                {orderLines.map((line) => (
                  <tr key={line.productId} className="bg-primary-50/50">
                    <td className="px-3 py-2">
                      <img
                        src={getFullImageUrl(line.product.imageUrl)}
                        alt={line.product.description || line.product.reference}
                        className="h-8 w-8 rounded object-cover bg-[--k-surface-2]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-[--k-text]">
                      {line.product.description || line.product.reference}
                    </td>
                    <td className="px-3 py-2 text-[--k-muted] font-mono text-xs">
                      {line.product.reference}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Prix"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.productId, 'unitPrice', e.target.value)}
                        className="w-24 rounded border border-[--k-border] bg-[--k-surface] px-2 py-1 text-[13px] text-[--k-text] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity || ''}
                        onChange={(e) => updateLine(line.productId, 'quantity', e.target.value)}
                        placeholder="1"
                        className="w-20 rounded border border-primary-500 bg-primary-50 px-2 py-1 text-[13px] text-center font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeProduct(line.productId)}
                        className="rounded p-1 text-[--k-danger] hover:bg-red-50 hover:text-red-700"
                        title="Retirer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Picker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setIsPickerOpen(false)}>
          <div
            className="w-full max-w-lg mx-4 rounded-2xl bg-[--k-surface] shadow-xl border border-[--k-border]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[--k-border]">
              <h3 className="text-[13px] font-medium text-[--k-text] mb-3">
                Ajouter un produit
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou référence..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  autoFocus
                  className="h-9 w-full rounded-xl border border-[--k-border] bg-[--k-surface] pl-10 pr-4 text-[13px] text-[--k-text] placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                  <span className="ml-2 text-[13px] text-[--k-muted]">Chargement...</span>
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[--k-muted]">
                  {supplierProducts?.length === orderLines.length
                    ? 'Tous les produits ont été ajoutés'
                    : 'Aucun produit trouvé'}
                </div>
              ) : (
                <div className="divide-y divide-[--k-border]">
                  {availableProducts.map((product) => {
                    const ps = product.productSuppliers?.find(ps => ps.supplierId === selectedSupplierId);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[--k-bg] transition-colors"
                      >
                        <img
                          src={getFullImageUrl(product.imageUrl)}
                          alt={product.description || product.reference}
                          className="h-9 w-9 rounded object-cover bg-[--k-surface-2] flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[--k-text] truncate">
                            {product.description || product.reference}
                          </p>
                          <p className="text-xs text-[--k-muted]">
                            {product.reference}
                            {ps?.unitPrice ? ` — ${Number(ps.unitPrice).toFixed(2)} €` : ''}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-[--k-primary] flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[--k-border] flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsPickerOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <RichTextEditor
          content={comment}
          onChange={setComment}
          placeholder="Commentaire optionnel..."
          fetchMentions={() => []}
        />
      </div>

      {/* Summary */}
      {validLines.length > 0 && (
        <div className="rounded-xl bg-[--k-surface-2] p-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[--k-muted]">
              <ShoppingCart className="inline h-4 w-4 mr-1" />
              {validLines.length} article{validLines.length > 1 ? 's' : ''} — {validLines.reduce((s, i) => s + i.quantity, 0)} unités
            </span>
            {totalEstime > 0 && (
              <span className="font-semibold text-[--k-primary]">
                Total estimé : {totalEstime.toFixed(2)} € HT
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {saveMutation.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[13px] text-[--k-danger]">
          {(saveMutation.error as any)?.response?.data?.error || (isCreating ? 'Erreur lors de la création' : 'Erreur lors de la mise à jour')}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[--k-border]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!name.trim() || !selectedSupplierId || validLines.length === 0}
          isLoading={saveMutation.isPending}
        >
          {isCreating ? 'Créer' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
