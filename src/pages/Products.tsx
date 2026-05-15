import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Eye, Link, X, ZoomIn, Download } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import Modal from '../components/ui/Modal';
import ProductForm from '../components/forms/ProductForm';
import ProductSupplierForm from '../components/forms/ProductSupplierForm';
import { useToast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import type { Product, PaginatedResponse, Assembly, AssemblyType } from '../types';

// Helper to get full image URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Lire search et page depuis l'URL
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const assemblyTypeId = searchParams.get('assemblyTypeId') || '';
  const assemblyId = searchParams.get('assemblyId') || '';
  const partCategoryId = searchParams.get('partCategoryId') || '';
  const serialFilter = searchParams.get('serial') || '';

  const setSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset assemblyId if assemblyTypeId changes
    if (key === 'assemblyTypeId') {
      params.delete('assemblyId');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Fetch assembly types
  const { data: assemblyTypesData } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<AssemblyType>>('/assembly-types?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch assemblies
  const { data: assembliesData } = useQuery({
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
      const res = await api.get<{ success: boolean; data: { id: string; name: string }[] }>('/part-categories');
      return res.data?.data || [];
    },
  });

  // Filter assemblies by selected type
  const filteredAssemblies = assemblyTypeId
    ? assembliesData?.filter((assembly) =>
        assembly.assemblyTypes?.some((at: any) =>
          at.assemblyTypeId === assemblyTypeId || at.id === assemblyTypeId
        )
      )
    : assembliesData;

  const hasActiveFilters = search || assemblyTypeId || assemblyId || partCategoryId || serialFilter || page > 1;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [supplierModalProduct, setSupplierModalProduct] = useState<Product | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, assemblyTypeId, assemblyId, partCategoryId, serialFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(assemblyTypeId && { assemblyTypeId }),
        ...(assemblyId && { assemblyId }),
        ...(partCategoryId && { partCategoryId }),
        ...(serialFilter && { hasSerialNumber: serialFilter }),
      });
      const res = await api.get<PaginatedResponse<Product>>(`/products?${params}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      setDeleteConfirm(null);
      toast.success('Produit supprimé', 'Le produit a été supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le produit');
    },
  });

  const getRiskBadge = (risk?: string) => {
    if (!risk) return null;
    const variants: Record<string, 'danger' | 'warning' | 'success'> = {
      HIGH: 'danger',
      MEDIUM: 'warning',
      LOW: 'success',
    };
    const labels: Record<string, string> = {
      HIGH: 'Fort',
      MEDIUM: 'Moyen',
      LOW: 'Faible',
    };
    return <Badge variant={variants[risk]}>{labels[risk]}</Badge>;
  };

  const handleCreate = () => {
    setSelectedProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedProduct(undefined);
  };

  const handleSuccess = (isEdit: boolean) => {
    handleModalClose();
    toast.success(
      isEdit ? 'Produit modifié' : 'Produit créé',
      isEdit ? 'Le produit a été mis à jour avec succès' : 'Le produit a été créé avec succès'
    );
  };

  const totalCount = data?.pagination?.total ?? 0;

  // Mobile card component
  const ProductCard = ({ product }: { product: Product }) => (
    <div className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => product.imageUrl && setLightboxProduct(product)}
          disabled={!product.imageUrl}
          className={`group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[--k-border] bg-[--k-surface-2] ${product.imageUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
        >
          <img
            src={getFullImageUrl(product.imageUrl)}
            alt={product.reference}
            className="h-full w-full object-cover"
          />
          {product.imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/products/${product.id}`)}
            className="font-medium text-[--k-primary] hover:text-indigo-700 hover:underline text-left truncate block w-full"
          >
            {product.description || product.reference}
          </button>
          <p className="text-[13px] text-[--k-muted] truncate mt-0.5">
            {product.reference}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {getRiskBadge(product.supplyRisk)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
        <div>
          <span className="text-[--k-muted]">Borne:</span>
          <p className="text-[--k-text] truncate">
            {product.assembly?.name || product.assemblyType?.name || '-'}
          </p>
        </div>
        <div>
          <span className="text-[--k-muted]">Fournisseur:</span>
          <p className="truncate">
            {product.productSuppliers?.[0]?.supplier ? (
              <RouterLink
                to={`/suppliers/${product.productSuppliers[0].supplier.id}`}
                className="text-[--k-primary] hover:underline"
              >
                {product.productSuppliers[0].supplier.name}
              </RouterLink>
            ) : '-'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-[--k-border] pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/products/${product.id}`)}
          title="Voir"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSupplierModalProduct(product)}
          title="Gérer fournisseurs"
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEdit(product)}
          title="Modifier"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteConfirm(product)}
          title="Supprimer"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Produits" subtitle="Gestion du catalogue produits">
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouveau produit</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </PageHeader>

      {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Search */}
          <div className="relative min-w-[140px] sm:w-[352px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          {/* Filters - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <SearchSelect
              value={assemblyTypeId}
              onChange={(val) => setFilter('assemblyTypeId', val)}
              options={assemblyTypesData?.map((type) => ({ value: type.id, label: type.name })) || []}
              placeholder="Type borne"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={assemblyId}
              onChange={(val) => setFilter('assemblyId', val)}
              options={filteredAssemblies?.map((assembly) => ({ value: assembly.id, label: assembly.name })) || []}
              placeholder="Borne"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={partCategoryId}
              onChange={(val) => setFilter('partCategoryId', val)}
              options={partCategoriesData?.map((c) => ({ value: c.id, label: c.name })) || []}
              placeholder="Catégorie de pièce"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={serialFilter}
              onChange={(val) => setFilter('serial', val)}
              options={[
                { value: 'true', label: 'Avec n° de série' },
                { value: 'false', label: 'Sans n° de série' },
              ]}
              placeholder="N° de série"
              className="min-w-[140px] sm:w-[352px]"
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-[--k-muted] whitespace-nowrap"
              >
                <X className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : (data?.data || []).length === 0 ? (
          <div className="py-8 text-center text-[--k-muted]">
            Aucun produit trouvé
          </div>
        ) : (
          <div className="space-y-3">
            {(data?.data || []).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {data && (
          <Pagination
            currentPage={page}
            totalPages={data.pagination.totalPages}
            totalItems={data.pagination.total}
            onPageChange={setPage}
            className="pt-4"
          />
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        {/* Table header bar */}
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="text-lg font-semibold text-[--k-text]">Produits</div>
          <div className="text-xs text-[--k-muted]">{totalCount} {totalCount > 1 ? 'éléments' : 'élément'}</div>
        </div>

        <div>
          <table className="w-full text-[13px]">
            <thead className="sticky -top-5 z-10">
              <tr className="border-b border-[--k-border] bg-white text-[--k-muted]">
                <th className="px-4 py-2 text-left text-xs font-medium bg-white">
                  Produit
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium bg-white">
                  Borne
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium bg-white">
                  Fournisseur
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium bg-white">
                  Risque appro
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium bg-white">
                  Emplacement
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium bg-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[--k-surface]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
                      <span className="ml-2 text-[--k-muted]">Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : (data?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[--k-muted]">
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                (data?.data || []).map((product) => (
                  <tr key={product.id} className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors">
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => product.imageUrl && setLightboxProduct(product)}
                          disabled={!product.imageUrl}
                          className={`group relative h-[5rem] w-[5rem] flex-shrink-0 overflow-hidden rounded-lg border border-[--k-border] bg-[--k-surface-2] ${product.imageUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
                        >
                          <img
                            src={getFullImageUrl(product.imageUrl)}
                            alt={product.reference}
                            className="h-full w-full object-cover"
                          />
                          {product.imageUrl && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </button>
                        <div className="flex flex-col">
                          <button
                            onClick={() => navigate(`/products/${product.id}`)}
                            className="text-[16px] font-medium text-[--k-primary] hover:text-indigo-700 hover:underline text-left"
                          >
                            {product.description || product.reference}
                          </button>
                          <span className="text-[15px] text-[--k-muted] truncate max-w-xs">
                            {product.reference}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex flex-col">
                        <span className="text-[--k-muted]">
                          {product.assembly?.name || (product.assemblyType ? '' : '-')}
                        </span>
                        {product.assemblyType && (
                          <span className="text-xs text-[--k-muted]">
                            {product.assemblyType.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5">
                      {product.productSuppliers?.[0]?.supplier ? (
                        <RouterLink
                          to={`/suppliers/${product.productSuppliers[0].supplier.id}`}
                          className="text-[--k-primary] hover:underline"
                        >
                          {product.productSuppliers[0].supplier.name}
                        </RouterLink>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5">
                      {getRiskBadge(product.supplyRisk)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5">
                      <span className="text-[--k-muted]">{product.location || '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/products/${product.id}`)}
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSupplierModalProduct(product)}
                          title="Gérer fournisseurs"
                        >
                          <Link className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(product)}
                          title="Supprimer"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Pagination Footer */}
        <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
          <span>{totalCount} résultat{totalCount > 1 ? 's' : ''}</span>
          {data && (
            <Pagination
              currentPage={page}
              totalPages={data.pagination.totalPages}
              totalItems={data.pagination.total}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={selectedProduct ? 'Modifier le produit' : 'Nouveau produit'}
        size="lg"
      >
        <ProductForm
          product={selectedProduct}
          onSuccess={() => handleSuccess(!!selectedProduct)}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le produit{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.reference}</span> ?
          </p>
          <p className="text-[13px] text-red-600">
            Cette action est irréversible et supprimera également les stocks et mouvements associés.
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

      {/* Supplier Management Modal */}
      <Modal
        isOpen={!!supplierModalProduct}
        onClose={() => setSupplierModalProduct(null)}
        title={`Fournisseurs - ${supplierModalProduct?.reference}`}
        size="lg"
      >
        {supplierModalProduct && (
          <ProductSupplierForm
            product={supplierModalProduct}
            onClose={() => setSupplierModalProduct(null)}
          />
        )}
      </Modal>

      {/* Image Lightbox */}
      {lightboxProduct && lightboxProduct.imageUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setLightboxProduct(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getFullImageUrl(lightboxProduct.imageUrl)}
              alt={lightboxProduct.reference}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain bg-white p-4"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a
                href={getFullImageUrl(lightboxProduct.imageUrl)}
                download={`${lightboxProduct.reference}.png`}
                className="rounded-lg bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                title="Télécharger"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                onClick={() => setLightboxProduct(null)}
                className="rounded-lg bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                title="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
