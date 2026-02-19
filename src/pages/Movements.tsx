import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  ArrowRight,
  User,
  Package,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { KpiCard } from '../components/KpiCard';
import Modal from '../components/ui/Modal';
import MovementForm from '../components/forms/MovementForm';
import PackMovementForm from '../components/forms/PackMovementForm';
import { useToast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import type { StockMovement, Site, ApiResponse, PaginatedResponse } from '../types';

export default function Movements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPackMovementModalOpen, setIsPackMovementModalOpen] = useState(false);
  const toast = useToast();

  // URL params for filters
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const typeFilter = searchParams.get('type') || '';
  const siteFilter = searchParams.get('site') || '';
  const conditionFilter = searchParams.get('condition') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const updateParams = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change (except page itself)
    if (!('page' in updates)) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  // Fetch movements
  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['movements', page, typeFilter, siteFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (typeFilter) params.set('type', typeFilter);
      if (siteFilter) params.set('siteId', siteFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await api.get<PaginatedResponse<StockMovement>>(`/movements?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Fetch sites for filter
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data;
    },
  });

  // Filter movements by search (client-side)
  const filteredMovements = (movementsData?.data || []).filter((movement) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      movement.product.reference.toLowerCase().includes(searchLower) ||
      movement.product.description?.toLowerCase().includes(searchLower) ||
      movement.operator?.toLowerCase().includes(searchLower) ||
      movement.comment?.toLowerCase().includes(searchLower)
    );
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
      case 'OUT':
        return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
      case 'TRANSFER':
        return <ArrowLeftRight className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return <Badge variant="success">Entrée</Badge>;
      case 'OUT':
        return <Badge variant="danger">Sortie</Badge>;
      case 'TRANSFER':
        return <Badge variant="info">Transfert</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
    return condition === 'NEW' ? (
      <Badge variant="success">Neuf</Badge>
    ) : (
      <Badge variant="warning">Occasion</Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasFilters = typeFilter || siteFilter || startDate || endDate || search || conditionFilter;

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const pagination = movementsData?.pagination;

  // Mobile card component
  const MovementCard = ({ movement }: { movement: StockMovement }) => (
    <div className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getTypeIcon(movement.type)}
          {getTypeBadge(movement.type)}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-[--k-text]">
            {formatDate(movement.movementDate)}
          </p>
          <p className="text-xs text-[--k-muted]">
            {formatTime(movement.movementDate)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Link
          to={`/products/${movement.productId}`}
          className="font-medium text-[--k-primary] hover:text-indigo-700"
        >
          {movement.product.reference}
        </Link>
        {movement.product.description && (
          <p className="text-sm text-[--k-muted] truncate mt-0.5">
            {movement.product.description}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${
            movement.type === 'IN'
              ? 'text-green-600'
              : movement.type === 'OUT'
              ? 'text-red-600'
              : 'text-blue-600'
          }`}>
            {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}
            {movement.quantity}
          </span>
          {getConditionBadge(movement.condition)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2">
          <span className="text-[--k-muted]">Sites :</span>
          {movement.sourceSite && movement.targetSite ? (
            <p className="text-[--k-text] flex items-center gap-1">
              {movement.sourceSite.name}
              <ArrowRight className="h-3 w-3 shrink-0 text-[--k-muted]" />
              {movement.targetSite.name}
            </p>
          ) : (
            <p className="text-[--k-text]">
              {movement.targetSite?.name || movement.sourceSite?.name || '-'}
            </p>
          )}
        </div>
        {movement.operator && (
          <div className="col-span-2">
            <span className="text-[--k-muted]">Opérateur:</span>
            <p className="text-[--k-text] flex items-center gap-1">
              <User className="h-3 w-3 text-[--k-muted]" />
              {movement.operator}
            </p>
          </div>
        )}
        {movement.comment && (
          <div className="col-span-2">
            <span className="text-[--k-muted]">Commentaire:</span>
            <p className="text-[--k-text] text-sm">{movement.comment}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Mouvements de Stock"
        subtitle="Historique des entrées, sorties et transferts"
      >
        <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none">
          <Plus className="mr-1 h-4 w-4" />
          <span className="sm:hidden">Mouvement</span>
          <span className="hidden sm:inline">Nouveau mouvement</span>
        </Button>
        <Button variant="secondary" onClick={() => setIsPackMovementModalOpen(true)} className="flex-1 sm:flex-none">
          <Package className="mr-1 h-4 w-4" />
          <span className="sm:hidden">Pack</span>
          <span className="hidden sm:inline">Mouvement pack</span>
        </Button>
      </PageHeader>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Entrées" value={filteredMovements?.filter(m => m.type === 'IN').length || 0} icon={ArrowDownCircle} colorIndex={2} />
        <KpiCard title="Sorties" value={filteredMovements?.filter(m => m.type === 'OUT').length || 0} icon={ArrowUpCircle} colorIndex={1} />
        <KpiCard title="Transferts" value={filteredMovements?.filter(m => m.type === 'TRANSFER').length || 0} icon={ArrowLeftRight} colorIndex={5} />
        <KpiCard title="Total" value={pagination?.total || 0} icon={Package} colorIndex={0} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {/* Search */}
          <div className="relative min-w-[140px] sm:w-[352px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => updateParams({ search: e.target.value })}
              className="input-field !pl-10"
            />
          </div>

          {/* Filters - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <SearchSelect
              value={typeFilter}
              onChange={(val) => updateParams({ type: val })}
              options={[
                { value: 'IN', label: 'Entrée' },
                { value: 'OUT', label: 'Sortie' },
                { value: 'TRANSFER', label: 'Transfert' },
              ]}
              placeholder="Type"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={siteFilter}
              onChange={(val) => updateParams({ site: val })}
              options={sites?.map((s) => ({ value: s.id, label: s.name })) || []}
              placeholder="Site"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={conditionFilter}
              onChange={(val) => updateParams({ condition: val })}
              options={[
                { value: 'NEW', label: 'Neuf' },
                { value: 'USED', label: 'Occasion' },
              ]}
              placeholder="État"
              className="min-w-[140px] sm:w-[352px]"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => updateParams({ startDate: e.target.value })}
              className="input-field min-w-[130px]"
              title="Date de début"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateParams({ endDate: e.target.value })}
              className="input-field min-w-[130px]"
              title="Date de fin"
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="whitespace-nowrap">
              <Filter className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </Button>
          )}
        </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredMovements?.length === 0 ? (
          <div className="py-8 text-center text-[--k-muted]">
            Aucun mouvement trouvé
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMovements?.map((movement) => (
              <MovementCard key={movement.id} movement={movement} />
            ))}
          </div>
        )}

        {/* Mobile Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => updateParams({ page: String(p) })}
            totalItems={pagination.total}
            className="pt-4"
          />
        )}
      </div>

      {/* Desktop Movements Table */}
      <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
          <div className="text-lg font-semibold text-[--k-text]">Historique des mouvements</div>
          <div className="text-xs text-[--k-muted]">{filteredMovements?.length || 0} éléments</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredMovements?.length === 0 ? (
          <div className="py-12 text-center text-[--k-muted]">
            Aucun mouvement trouvé
          </div>
        ) : (
          <div>
            <table className="w-full text-[13px]">
              <thead className="sticky -top-5 z-10">
                <tr className="border-b border-[--k-border] bg-white">
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Date
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Type
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Référence
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Produit
                  </th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">
                    Quantité
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    État
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Sites
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Opérateur
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Commentaire
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements?.map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-b border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                  >
                    <td className="px-4 py-1.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-[--k-text]">
                          {formatDate(movement.movementDate)}
                        </span>
                        <span className="text-xs text-[--k-muted]">
                          {formatTime(movement.movementDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(movement.type)}
                        {getTypeBadge(movement.type)}
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <Link
                        to={`/products/${movement.productId}`}
                        className="font-mono text-[--k-primary] hover:text-indigo-700 hover:underline"
                      >
                        {movement.product.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-[--k-text] truncate max-w-[200px]">
                      {movement.product.description || '—'}
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      <span className={`font-bold ${
                        movement.type === 'IN'
                          ? 'text-green-600'
                          : movement.type === 'OUT'
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}>
                        {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}
                        {movement.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-1.5">
                      {getConditionBadge(movement.condition)}
                    </td>
                    <td className="px-4 py-1.5 text-[--k-muted]">
                      {movement.sourceSite && movement.targetSite ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[--k-text]">{movement.sourceSite.name}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-[--k-muted]" />
                          <span className="text-[--k-text]">{movement.targetSite.name}</span>
                        </span>
                      ) : (
                        <span>{movement.targetSite?.name || movement.sourceSite?.name || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      {movement.operator ? (
                        <div className="flex items-center gap-1 text-[--k-muted]">
                          <User className="h-3 w-3" />
                          {movement.operator}
                        </div>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      {movement.comment ? (
                        <span
                          className="text-[--k-muted] truncate max-w-[150px] block"
                          title={movement.comment}
                        >
                          {movement.comment}
                        </span>
                      ) : (
                        <span className="text-[--k-muted]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Desktop Pagination */}
        <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
          <span>{filteredMovements?.length || 0} résultat{(filteredMovements?.length || 0) > 1 ? 's' : ''}</span>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => updateParams({ page: String(p) })}
              totalItems={pagination.total}
            />
          )}
        </div>
      </div>

      {/* Create Movement Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouveau mouvement de stock"
        size="lg"
      >
        <MovementForm
          onSuccess={() => {
            setIsModalOpen(false);
            toast.success('Mouvement créé', 'Le mouvement de stock a été enregistré avec succès');
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Pack Movement Modal */}
      <Modal
        isOpen={isPackMovementModalOpen}
        onClose={() => setIsPackMovementModalOpen(false)}
        title="Mouvement du pack"
        size="lg"
      >
        <PackMovementForm
          onSuccess={() => {
            setIsPackMovementModalOpen(false);
            toast.success('Mouvement pack créé', 'Le mouvement du pack a été enregistré avec succès');
          }}
          onCancel={() => setIsPackMovementModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
