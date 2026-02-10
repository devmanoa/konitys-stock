import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Mail, Phone, Globe, Eye } from 'lucide-react';
import Button from '../components/ui/Button';
import SearchSelect from '../components/ui/SearchSelect';
import Modal from '../components/ui/Modal';
import SupplierForm from '../components/forms/SupplierForm';
import { useToast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import type { Supplier, PaginatedResponse, AssemblyType, ApiResponse } from '../types';

export default function Suppliers() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assemblyTypeId, setAssemblyTypeId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);

  // Fetch assembly types for filter
  const { data: assemblyTypes } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssemblyType[]>>('/assembly-types');
      return res.data?.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search, assemblyTypeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(assemblyTypeId && { assemblyTypeId }),
      });
      const res = await api.get<PaginatedResponse<Supplier>>(`/suppliers?${params}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteConfirm(null);
      toast.success('Fournisseur supprime', 'Le fournisseur a ete supprime avec succes');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le fournisseur');
    },
  });

  const handleCreate = () => {
    setSelectedSupplier(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSupplier(undefined);
  };

  const handleSuccess = (isEdit: boolean) => {
    handleModalClose();
    toast.success(
      isEdit ? 'Fournisseur modifie' : 'Fournisseur cree',
      isEdit ? 'Le fournisseur a ete mis a jour avec succes' : 'Le fournisseur a ete cree avec succes'
    );
  };

  // Mobile card component
  const SupplierCard = ({ supplier }: { supplier: Supplier }) => (
    <div className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <Link
            to={`/suppliers/${supplier.id}`}
            className="font-medium text-[--k-primary] hover:text-indigo-700 hover:underline"
          >
            {supplier.name}
          </Link>
          {supplier.contact && (
            <p className="text-[13px] text-[--k-muted] mt-0.5">
              {supplier.contact}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link to={`/suppliers/${supplier.id}`}>
            <Button variant="ghost" size="sm" title="Voir details">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(supplier)}
            title="Modifier"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirm(supplier)}
            title="Supprimer"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {supplier.email && (
          <a
            href={`mailto:${supplier.email}`}
            className="flex items-center gap-2 text-[13px] text-[--k-muted] hover:text-[--k-primary]"
          >
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </a>
        )}
        {supplier.phone && (
          <a
            href={`tel:${supplier.phone}`}
            className="flex items-center gap-2 text-[13px] text-[--k-muted] hover:text-[--k-primary]"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{supplier.phone}</span>
          </a>
        )}
        {supplier.website && (
          <a
            href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] text-[--k-muted] hover:text-[--k-primary]"
          >
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{supplier.website.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-[--k-border] pt-3 text-[13px]">
        <div>
          <span className="text-[--k-muted]">Produits: </span>
          <span className="font-medium text-[--k-text]">
            {supplier._count?.productSuppliers || 0}
          </span>
        </div>
        <div>
          <span className="text-[--k-muted]">Commandes: </span>
          <span className="font-medium text-[--k-text]">
            {supplier._count?.orders || 0}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Fournisseurs" subtitle="Gestion des fournisseurs">
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Ajouter</span>
          <span className="hidden sm:inline">Nouveau fournisseur</span>
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[140px] sm:w-[352px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field !pl-10"
          />
        </div>
        <SearchSelect
          value={assemblyTypeId}
          onChange={(val) => {
            setAssemblyTypeId(val);
            setPage(1);
          }}
          options={assemblyTypes?.map((type) => ({ value: type.id, label: type.name })) || []}
          placeholder="Type de borne"
          className="min-w-[140px] sm:w-[352px]"
        />
      </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : data?.data.length === 0 ? (
          <div className="py-8 text-center text-[--k-muted]">
            Aucun fournisseur trouve
          </div>
        ) : (
          <div className="space-y-3">
            {data?.data.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
            totalItems={data.pagination.total}
            className="pt-4"
          />
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        {/* Table header bar */}
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="text-[13px] font-semibold">Fournisseurs</div>
          <div className="text-xs text-[--k-muted]">{data?.data.length || 0} éléments</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : data?.data.length === 0 ? (
          <div className="py-12 text-center text-[--k-muted]">
            Aucun fournisseur trouve
          </div>
        ) : (
          <div>
            <table className="w-full text-[13px]">
              <thead className="sticky -top-5 z-10">
                <tr className="border-b border-[--k-border] bg-white">
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Nom
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Contact
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Email
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Telephone
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Site web
                  </th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">
                    Produits
                  </th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">
                    Commandes
                  </th>
                  <th className="px-4 py-1.5 text-right text-xs font-medium bg-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                  >
                    <td className="px-4 py-1.5">
                      <Link
                        to={`/suppliers/${supplier.id}`}
                        className="font-medium text-[--k-primary] hover:text-indigo-700 hover:underline"
                      >
                        {supplier.name}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-[--k-muted]">
                      {supplier.contact || '-'}
                    </td>
                    <td className="px-4 py-1.5">
                      {supplier.email ? (
                        <a
                          href={`mailto:${supplier.email}`}
                          className="flex items-center gap-1 text-[--k-muted] hover:text-[--k-primary]"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[150px]">{supplier.email}</span>
                        </a>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      {supplier.phone ? (
                        <a
                          href={`tel:${supplier.phone}`}
                          className="flex items-center gap-1 text-[--k-muted] hover:text-[--k-primary]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {supplier.phone}
                        </a>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      {supplier.website ? (
                        <a
                          href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[--k-muted] hover:text-[--k-primary]"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[120px]">
                            {supplier.website.replace(/^https?:\/\//, '')}
                          </span>
                        </a>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      <span className="font-medium text-[--k-text]">
                        {supplier._count?.productSuppliers || 0}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      <span className="font-medium text-[--k-text]">
                        {supplier._count?.orders || 0}
                      </span>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/suppliers/${supplier.id}`}>
                          <Button variant="ghost" size="sm" title="Voir details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(supplier)}
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(supplier)}
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

        {/* Table footer */}
        <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
          <span>{data?.data.length || 0} résultat{(data?.data.length || 0) > 1 ? 's' : ''}</span>
          {/* Desktop Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
              totalItems={data.pagination.total}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={selectedSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
        size="lg"
      >
        <SupplierForm
          supplier={selectedSupplier}
          onSuccess={() => handleSuccess(!!selectedSupplier)}
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
            Etes-vous sur de vouloir supprimer le fournisseur{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.name}</span> ?
          </p>
          <p className="text-[13px] text-red-600">
            Cette action est irreversible et supprimera egalement les liens avec les produits.
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
