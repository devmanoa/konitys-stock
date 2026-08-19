import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  ArrowRight,
  Package,
  Camera,
  SlidersHorizontal,
  X as XIcon,
} from 'lucide-react';
import Button from '../components/ui/Button';
import MobileMovementCard from './movements/MobileMovementCard';
import MobileFilterDrawer from './movements/MobileFilterDrawer';
import { stripHtml } from '../components/ui/RichTextDisplay';
import Badge from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { KpiCard } from '../components/KpiCard';
import Modal from '../components/ui/Modal';
import MovementForm from '../components/forms/MovementForm';
import PackMovementForm from '../components/forms/PackMovementForm';
import { useToast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import { PageHeader } from '../components/PageHeader';
import MovementDetail from '../components/MovementDetail';
import OperatorAvatar from '../components/OperatorAvatar';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { formatDate } from '../utils/date';
import { getMovementTypeIcon } from '../utils/productDisplay';
import type { StockMovement, Site, ApiResponse, PaginatedResponse } from '../types';

export default function Movements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPackMovementModalOpen, setIsPackMovementModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [scanPrefill, setScanPrefill] = useState<{
    productId?: string;
    type?: 'IN' | 'OUT' | 'TRANSFER';
  } | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  // Auto-open the create modal when arriving from /scan with prefill params.
  useEffect(() => {
    const action = searchParams.get('scanAction') as 'IN' | 'OUT' | 'TRANSFER' | null;
    const productId = searchParams.get('scanProductId');
    if (action && productId) {
      setScanPrefill({ productId, type: action });
      setIsModalOpen(true);
      // Consume the query params so a refresh doesn't reopen the modal.
      const next = new URLSearchParams(searchParams);
      next.delete('scanAction');
      next.delete('scanProductId');
      next.delete('scanSerialId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Filter movements by search (client-side) — defensive on every nested field
  // so a row with a missing product doesn't crash the whole page.
  const filteredMovements = (movementsData?.data || []).filter((movement) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      movement.product?.reference?.toLowerCase().includes(searchLower) ||
      stripHtml(movement.product?.description).toLowerCase().includes(searchLower) ||
      movement.operator?.toLowerCase().includes(searchLower) ||
      stripHtml(movement.comment).toLowerCase().includes(searchLower)
    );
  });

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

  const hasFilters = typeFilter || siteFilter || startDate || endDate || search || conditionFilter;

  // Mobile-only: count of filters currently active (search excluded — it has
  // its own visible input and clear button). Drives the badge on the
  // "Filtres" button and the row of removable chips below it.
  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    (siteFilter ? 1 : 0) +
    (conditionFilter ? 1 : 0) +
    (startDate || endDate ? 1 : 0);

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const pagination = movementsData?.pagination;

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-0">
      {/* Mobile-only user badge: since the topbar is hidden in fullscreen
          mobile mode, we surface the connected operator here so they can
          see "as who" they're recording movements. */}
      {user && (
        <div className="sm:hidden flex items-center gap-2 -mt-1">
          <OperatorAvatar
            name={user.fullName || user.username || ''}
            size="md"
          />
        </div>
      )}

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
        {/* Pack: desktop only — mobile users have the FAB + standard mouvement,
            pack is too niche to fight for header space on small screens. */}
        <Button
          variant="secondary"
          onClick={() => setIsPackMovementModalOpen(true)}
          className="hidden sm:inline-flex sm:flex-none"
        >
          <Package className="mr-1 h-4 w-4" />
          Mouvement pack
        </Button>
      </PageHeader>


      {/* Mobile: KPI pills scrollable + search + Filtres button. */}
      <div className="space-y-3 sm:hidden">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          <KpiPill
            label="Entrées"
            value={filteredMovements?.filter((m) => m.type === 'IN').length || 0}
            color="emerald"
            Icon={ArrowDownCircle}
          />
          <KpiPill
            label="Sorties"
            value={filteredMovements?.filter((m) => m.type === 'OUT').length || 0}
            color="rose"
            Icon={ArrowUpCircle}
          />
          <KpiPill
            label="Transferts"
            value={filteredMovements?.filter((m) => m.type === 'TRANSFER').length || 0}
            color="blue"
            Icon={ArrowLeftRight}
          />
          <KpiPill label="Total" value={pagination?.total || 0} color="slate" Icon={Package} />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => updateParams({ search: e.target.value })}
              className="input-field !pl-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="relative shrink-0 h-9 px-3 rounded-lg border border-[--k-border] bg-[--k-surface] flex items-center gap-1 text-[13px] font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[--k-primary] text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {typeFilter && (
              <ActiveChip onRemove={() => updateParams({ type: '' })}>
                {typeFilter === 'IN' ? 'Entrée' : typeFilter === 'OUT' ? 'Sortie' : 'Transfert'}
              </ActiveChip>
            )}
            {siteFilter && (
              <ActiveChip onRemove={() => updateParams({ site: '' })}>
                {sites?.find((s) => s.id === siteFilter)?.name || 'Site'}
              </ActiveChip>
            )}
            {conditionFilter && (
              <ActiveChip onRemove={() => updateParams({ condition: '' })}>
                {conditionFilter === 'NEW' ? 'Neuf' : 'Occasion'}
              </ActiveChip>
            )}
            {(startDate || endDate) && (
              <ActiveChip onRemove={() => updateParams({ startDate: '', endDate: '' })}>
                {startDate && endDate
                  ? `${startDate} → ${endDate}`
                  : startDate
                    ? `dès ${startDate}`
                    : `jusqu'à ${endDate}`}
              </ActiveChip>
            )}
          </div>
        )}
      </div>

      {/* Desktop: original KPI cards. */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard title="Entrées" value={filteredMovements?.filter(m => m.type === 'IN').length || 0} icon={ArrowDownCircle} colorIndex={2} />
        <KpiCard title="Sorties" value={filteredMovements?.filter(m => m.type === 'OUT').length || 0} icon={ArrowUpCircle} colorIndex={1} />
        <KpiCard title="Transferts" value={filteredMovements?.filter(m => m.type === 'TRANSFER').length || 0} icon={ArrowLeftRight} colorIndex={5} />
        <KpiCard title="Total" value={pagination?.total || 0} icon={Package} colorIndex={0} />
      </div>

      {/* Desktop filters (unchanged). */}
      <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end gap-3">
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
          <div className="space-y-2">
            {filteredMovements?.map((movement) => (
              <MobileMovementCard
                key={movement.id}
                movement={movement}
                onOpenDetail={setSelectedMovement}
              />
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
            <table className="w-full text-[13px] table-zebra">
              <thead className="sticky -top-5 z-10">
                <tr className="border-b border-[--k-border] bg-white">
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Date
                  </th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                    Type
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
                    onClick={() => setSelectedMovement(movement)}
                    className="border-b border-[--k-border] row-hover transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-1.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-[--k-text]">
                          {formatDate(movement.movementDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        {getMovementTypeIcon(movement.type)}
                        {getTypeBadge(movement.type)}
                      </div>
                    </td>
                    <td className="px-4 py-1.5 truncate max-w-[260px]">
                      <Link
                        to={`/products/${movement.productId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block font-medium text-[--k-primary] hover:text-indigo-700 hover:underline truncate"
                      >
                        {movement.product?.description || movement.product?.reference || 'Produit inconnu'}
                      </Link>
                      {movement.product?.description && (
                        <span className="block text-xs text-[--k-muted] font-mono truncate">
                          {movement.product.reference}
                        </span>
                      )}
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
                      <OperatorAvatar name={movement.operator} />
                    </td>
                    <td className="px-4 py-1.5">
                      {movement.comment ? (
                        <span
                          className="text-[--k-muted] truncate max-w-[150px] block"
                          title={stripHtml(movement.comment)}
                        >
                          {stripHtml(movement.comment)}
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
        onClose={() => {
          setIsModalOpen(false);
          setScanPrefill(null);
        }}
        title="Nouveau mouvement de stock"
        size="lg"
      >
        <MovementForm
          preselectedProductId={scanPrefill?.productId}
          preselectedType={scanPrefill?.type}
          onSuccess={() => {
            setIsModalOpen(false);
            setScanPrefill(null);
            toast.success('Mouvement créé', 'Le mouvement de stock a été enregistré avec succès');
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setScanPrefill(null);
          }}
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

      {/* Movement Detail Modal */}
      <Modal
        isOpen={!!selectedMovement}
        onClose={() => setSelectedMovement(null)}
        title="Détail du mouvement"
        size="lg"
      >
        {selectedMovement && (
          <MovementDetail movement={selectedMovement} />
        )}
      </Modal>

      {/* Mobile filter drawer */}
      <MobileFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        initial={{
          type: typeFilter,
          site: siteFilter,
          condition: conditionFilter,
          startDate,
          endDate,
        }}
        sites={sites || []}
        onApply={(f) =>
          updateParams({
            type: f.type,
            site: f.site,
            condition: f.condition,
            startDate: f.startDate,
            endDate: f.endDate,
          })
        }
        onReset={resetFilters}
      />

      {/* Mobile FAB: floating scanner button, always reachable. */}
      <button
        type="button"
        onClick={() => navigate('/scan')}
        className="sm:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-[--k-primary] text-white shadow-xl flex items-center justify-center active:scale-95 transition"
        aria-label="Scanner un QR code"
      >
        <Camera className="h-6 w-6" />
      </button>
    </div>
  );
}

function KpiPill({
  label,
  value,
  color,
  Icon,
}: {
  label: string
  value: number
  color: 'emerald' | 'rose' | 'blue' | 'slate'
  Icon: typeof ArrowDownCircle
}) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }[color]
  return (
    <div
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${palette}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-bold tabular-nums text-[13px]">{value}</span>
      <span className="text-[11px] opacity-80">{label}</span>
    </div>
  )
}

function ActiveChip({
  onRemove,
  children,
}: {
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[--k-primary]/10 text-[--k-primary] pl-2.5 pr-1 py-1 text-[12px] font-medium">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-[--k-primary]/20"
        aria-label="Retirer ce filtre"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  )
}
