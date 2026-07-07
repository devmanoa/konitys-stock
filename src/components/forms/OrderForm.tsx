import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ShoppingCart, Plus, Trash2, Search, ExternalLink } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import SupplierSearch from '../ui/SupplierSearch';
import RichTextEditor from '../ui/RichTextEditor';
import api from '../../services/api';
import type { Supplier, Site, Product, ProductSupplier, Order, ApiResponse, PaginatedResponse } from '../../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

interface ProductWithSupplierInfo extends Product {
  productSuppliers: (ProductSupplier & { supplier: Supplier })[];
}

interface OrderLine {
  productId: string;
  product: ProductWithSupplierInfo;
  quantity: number;
  unitPrice: string;
}

interface OrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  duplicateFrom?: Order;
}

export default function OrderForm({ onSuccess, onCancel, duplicateFrom }: OrderFormProps) {
  const queryClient = useQueryClient();

  // Step management
  const [step, setStep] = useState<1 | 2>(duplicateFrom ? 2 : 1);
  const [selectedSupplierId, setSelectedSupplierId] = useState(duplicateFrom?.supplierId || '');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(duplicateFrom?.supplier || null);

  // Order header fields
  const [title, setTitle] = useState(duplicateFrom?.title ? `${duplicateFrom.title} (copie)` : '');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [destinationSiteId, setDestinationSiteId] = useState(duplicateFrom?.destinationSiteId || '');
  const [responsible, setResponsible] = useState(duplicateFrom?.responsible || '');
  const [supplierRef, setSupplierRef] = useState('');
  const [shippingCost, setShippingCost] = useState<string>(
    duplicateFrom?.shippingCost != null ? String(duplicateFrom.shippingCost) : '',
  );
  const [comment, setComment] = useState(duplicateFrom?.comment || '');

  // Selected product lines — pré-remplies si duplication
  const [orderLines, setOrderLines] = useState<OrderLine[]>(
    duplicateFrom?.items?.map((item) => ({
      productId: item.productId,
      product: (item.product || {}) as ProductWithSupplierInfo,
      quantity: item.quantity,
      unitPrice: item.unitPrice ? String(Number(item.unitPrice)) : '',
    })) || []
  );

  // Product picker modal
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
      const res = await api.get<PaginatedResponse<ProductWithSupplierInfo>>(`/products?supplierId=${selectedSupplierId}&limit=10000`);
      return res.data?.data || [];
    },
    enabled: !!selectedSupplierId && step === 2,
  });

  // Products available to add (not already in orderLines)
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

  const addProduct = (product: ProductWithSupplierInfo) => {
    const ps = product.productSuppliers?.find(ps => ps.supplierId === selectedSupplierId);
    setOrderLines(prev => [...prev, {
      productId: product.id,
      product,
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = validLines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice ? parseFloat(line.unitPrice) : undefined,
      }));

      const parsedShipping = shippingCost.trim() === '' ? null : Number(shippingCost);
      const payload = {
        supplierId: selectedSupplierId,
        title: title || undefined,
        orderDate: new Date(orderDate).toISOString(),
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        destinationSiteId: destinationSiteId || undefined,
        responsible: responsible || undefined,
        supplierRef: supplierRef || undefined,
        comment: comment || undefined,
        shippingCost: parsedShipping != null && !Number.isNaN(parsedShipping) ? parsedShipping : null,
        items,
      };

      const res = await api.post('/orders', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      onSuccess();
    },
  });

  const handleSupplierChange = (supplierId: string, supplier: Supplier | null) => {
    setSelectedSupplierId(supplierId);
    setSelectedSupplier(supplier);
    setOrderLines([]);
  };

  const goToStep2 = () => {
    if (selectedSupplierId) {
      setStep(2);
    }
  };

  const goToStep1 = () => {
    setStep(1);
    setOrderLines([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validLines.length === 0) return;
    createMutation.mutate();
  };

  // Step 1: Choose supplier
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-[13px] text-[--k-muted] mb-4">
            Sélectionnez le fournisseur auprès duquel vous souhaitez passer commande.
          </p>
          <SupplierSearch
            onChange={handleSupplierChange}
          />
        </div>

        {selectedSupplier && (
          <div className="rounded-xl bg-[--k-surface-2] p-4">
            <p className="font-medium text-[--k-text]">{selectedSupplier.name}</p>
            {selectedSupplier.contact && (
              <p className="text-[13px] text-[--k-muted]">{selectedSupplier.contact}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-[--k-border]">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={goToStep2}
            disabled={!selectedSupplierId}
          >
            Suivant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Select products and quantities
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Back button + supplier info */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={goToStep1}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[13px] text-[--k-muted]">Fournisseur</p>
          <p className="font-medium text-[--k-text]">{selectedSupplier?.name}</p>
        </div>
      </div>

      {/* Title */}
      <Input
        id="title"
        label="Titre / Objet de la commande"
        placeholder="Ex: Réappro mensuel janvier"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Header fields in grid */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="orderDate"
          type="date"
          label="Date de commande *"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
        />
        <Input
          id="expectedDate"
          type="date"
          label="Date de livraison prévue"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
        />
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
          id="supplierRef"
          label="Réf. fournisseur"
          placeholder="Ex: CMD-2024-001"
          value={supplierRef}
          onChange={(e) => setSupplierRef(e.target.value)}
        />
        <Input
          id="responsible"
          label="Responsable"
          placeholder="Nom du responsable"
          value={responsible}
          onChange={(e) => setResponsible(e.target.value)}
        />
        <Input
          id="shippingCost"
          label="Frais de livraison (€)"
          type="number"
          step="0.01"
          min={0}
          placeholder="0,00"
          value={shippingCost}
          onChange={(e) => setShippingCost(e.target.value)}
        />
      </div>

      {/* Selected products lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-medium text-[--k-text]">
            Articles ({orderLines.length})
          </h4>
          <Button
            type="button"
            size="sm"
            onClick={() => { setPickerSearch(''); setIsPickerOpen(true); }}
            disabled={productsLoading}
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
              disabled={productsLoading}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un produit
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[--k-border] rounded-xl">
            <table className="w-full text-[13px] table-zebra">
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
                      <div className="flex items-center gap-1.5">
                        <span>{line.product.description || line.product.reference}</span>
                        <a
                          href={`/products/${line.productId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[--k-muted] hover:text-[--k-primary]"
                          title="Ouvrir la fiche produit dans un nouvel onglet"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
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

      {/* Product Picker Dropdown */}
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
                        onClick={() => {
                          addProduct(product);
                          // Keep picker open to allow adding more
                        }}
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
      {createMutation.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[13px] text-[--k-danger]">
          {(createMutation.error as any)?.response?.data?.error || 'Erreur lors de la création'}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[--k-border]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={validLines.length === 0}
          isLoading={createMutation.isPending}
        >
          Créer la commande ({validLines.length} article{validLines.length > 1 ? 's' : ''})
        </Button>
      </div>
    </form>
  );
}
