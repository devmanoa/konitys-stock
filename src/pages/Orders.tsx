import { useState, useRef, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Calendar,
  Hash,
  MoreVertical,
  Copy,
  PackageCheck,
  Eye,
  FileText,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { KpiCard } from '../components/KpiCard';
import Modal from '../components/ui/Modal';
import OrderForm from '../components/forms/OrderForm';
import { useToast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import type { Order, Supplier, OrderTemplate, ApiResponse, PaginatedResponse } from '../types';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [duplicateOrder, setDuplicateOrder] = useState<Order | undefined>(undefined);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // URL params for filters
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const supplierFilter = searchParams.get('supplier') || '';
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
    if (!('page' in updates)) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, statusFilter, supplierFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (supplierFilter) params.set('supplierId', supplierFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await api.get<PaginatedResponse<Order>>(`/orders?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Supplier[]>>('/suppliers');
      return res.data?.data;
    },
  });

  // Fetch templates (chargé quand le picker est ouvert)
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['order-templates'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OrderTemplate[]>>('/order-templates');
      return res.data?.data;
    },
    enabled: isTemplatePickerOpen,
  });

  // Helper: total qty of an order (sum of items)
  const getOrderTotalQty = (order: Order) =>
    order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Helper: total received qty
  const getOrderReceivedQty = (order: Order) =>
    order.items?.reduce((sum, item) => sum + (item.receivedQty || 0), 0) || 0;

  // Helper: order title/description for display
  const getOrderLabel = (order: Order) => {
    if (order.title) return order.title;
    if (order.items?.length === 1) {
      const item = order.items[0];
      return item.product?.description || item.product?.reference || 'Commande';
    }
    return `${order.items?.length || 0} article${(order.items?.length || 0) > 1 ? 's' : ''}`;
  };

  // Filter orders by search (client-side)
  const filteredOrders = (ordersData?.data || []).filter((order) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.title?.toLowerCase().includes(searchLower) ||
      order.supplier.name.toLowerCase().includes(searchLower) ||
      order.responsible?.toLowerCase().includes(searchLower) ||
      order.items?.some(
        (item) =>
          item.product?.reference?.toLowerCase().includes(searchLower) ||
          item.product?.description?.toLowerCase().includes(searchLower)
      )
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">En cours</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Terminée</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Annulée</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const hasFilters = statusFilter || supplierFilter || startDate || endDate || search;

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const pagination = ordersData?.pagination;

  // Stats
  const pendingCount = filteredOrders?.filter(o => o.status === 'PENDING').length || 0;
  const completedCount = filteredOrders?.filter(o => o.status === 'COMPLETED').length || 0;
  const cancelledCount = filteredOrders?.filter(o => o.status === 'CANCELLED').length || 0;
  const totalQuantityPending = filteredOrders
    ?.filter(o => o.status === 'PENDING')
    .reduce((sum, o) => sum + getOrderTotalQty(o), 0) || 0;

  // Fermer le dropdown au clic extérieur
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openDropdownId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    // Utiliser setTimeout pour éviter que le click actuel ferme le menu
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdownId]);

  // Composant menu actions
  const ActionsDropdown = ({ order }: { order: Order }) => {
    const isOpen = openDropdownId === order.id;

    return (
      <div ref={isOpen ? dropdownRef : undefined} className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpenDropdownId(isOpen ? null : order.id);
          }}
          className="rounded-lg p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-[--k-border] bg-[--k-surface] py-1 shadow-lg">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpenDropdownId(null);
                navigate(`/orders/${order.id}`);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[--k-text] hover:bg-[--k-surface-2]"
            >
              <Eye className="h-4 w-4" />
              Voir détail
            </button>
            {order.status === 'PENDING' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOpenDropdownId(null);
                  navigate(`/orders/${order.id}`);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[--k-text] hover:bg-[--k-surface-2]"
              >
                <PackageCheck className="h-4 w-4" />
                Réceptionner
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpenDropdownId(null);
                setDuplicateOrder(order);
                setIsCreateModalOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[--k-text] hover:bg-[--k-surface-2]"
            >
              <Copy className="h-4 w-4" />
              Dupliquer
            </button>
          </div>
        )}
      </div>
    );
  };

  // Mobile card component
  const OrderCard = ({ order }: { order: Order }) => {
    const totalQty = getOrderTotalQty(order);
    const receivedQty = getOrderReceivedQty(order);

    return (
      <div
        onClick={() => navigate(`/orders/${order.id}`)}
        className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4 cursor-pointer hover:border-[--k-primary] transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-[--k-primary]">
              {order.orderNumber}
            </p>
            <p className="font-medium text-[--k-text] mt-0.5">
              {getOrderLabel(order)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(order.status)}
            {getStatusBadge(order.status)}
            <ActionsDropdown order={order} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-[--k-muted]">Fournisseur:</span>
            <p className="truncate flex items-center gap-1">
              <Truck className="h-3 w-3 text-[--k-muted]" />
              <RouterLink
                to={`/suppliers/${order.supplierId}`}
                className="text-[--k-primary] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {order.supplier.name}
              </RouterLink>
            </p>
          </div>
          <div>
            <span className="text-[--k-muted]">Quantité:</span>
            <p className="font-bold text-[--k-text]">
              {totalQty}
              {receivedQty > 0 && receivedQty !== totalQty && (
                <span className="ml-1 text-xs font-normal text-[--k-muted]">(reçu: {receivedQty})</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-[--k-muted]">Date commande:</span>
            <p className="text-[--k-text] flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[--k-muted]" />
              {formatDate(order.orderDate)}
            </p>
          </div>
          <div>
            <span className="text-[--k-muted]">Articles:</span>
            <p className="text-[--k-text]">
              {order.items?.length || 0}
            </p>
          </div>
          {order.destinationSite && (
            <div className="col-span-2">
              <span className="text-[--k-muted]">Destination:</span>
              <p className="text-[--k-text]">{order.destinationSite.name}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader title="Commandes" subtitle="Gestion des commandes fournisseurs">
        <Button variant="outline" onClick={() => setIsTemplatePickerOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Modèle</span>
          <span className="hidden sm:inline">À partir d'un modèle</span>
        </Button>
        <Button onClick={() => { setDuplicateOrder(undefined); setIsCreateModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Ajouter</span>
          <span className="hidden sm:inline">Nouvelle commande</span>
        </Button>
      </PageHeader>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="En cours" value={pendingCount} icon={Clock} colorIndex={4} />
        <KpiCard title="Terminées" value={completedCount} icon={CheckCircle} colorIndex={2} />
        <KpiCard title="Annulées" value={cancelledCount} icon={XCircle} colorIndex={1} />
        <KpiCard title="Qté attente" value={totalQuantityPending} icon={Package} colorIndex={0} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[--k-border]">
        {[
          { value: '', label: 'Toutes' },
          { value: 'PENDING', label: 'En cours' },
          { value: 'COMPLETED', label: 'Terminées' },
          { value: 'CANCELLED', label: 'Annulées' },
        ].map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => updateParams({ status: tab.value })}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[--k-primary]'
                  : 'text-[--k-muted] hover:text-[--k-text]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[--k-primary]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Row 1: Search + Fournisseur */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[140px] sm:w-[352px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher (n° commande, titre, fournisseur...)"
              value={search}
              onChange={(e) => updateParams({ search: e.target.value })}
              className="input-field !pl-10"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <SearchSelect
              value={supplierFilter}
              onChange={(val) => updateParams({ supplier: val })}
              options={suppliers?.map((s) => ({ value: s.id, label: s.name })) || []}
              placeholder="Fournisseur"
              className="min-w-[140px] sm:w-[352px]"
            />
          </div>
        </div>

        {/* Row 2: Dates + Réinitialiser */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateParams({ startDate: e.target.value })}
            className="input-field min-w-[140px] sm:w-[352px]"
            title="Date de début"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateParams({ endDate: e.target.value })}
            className="input-field min-w-[140px] sm:w-[352px]"
            title="Date de fin"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="whitespace-nowrap">
              <Filter className="h-4 w-4 sm:mr-1" />
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
        ) : filteredOrders?.length === 0 ? (
          <div className="py-8 text-center text-[--k-muted]">
            Aucune commande trouvée
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders?.map((order) => (
              <OrderCard key={order.id} order={order} />
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

      {/* Desktop Orders Table */}
      <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredOrders?.length === 0 ? (
          <div className="py-12 text-center text-[--k-muted]">
            Aucune commande trouvée
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
              <div className="text-lg font-semibold text-[--k-text]">Liste des commandes</div>
              <div className="text-xs text-[--k-muted]">{filteredOrders?.length || 0} éléments</div>
            </div>
            <div>
              <table className="w-full text-[13px]">
                <thead className="sticky -top-5 z-10">
                  <tr className="border-b border-[--k-border] bg-white">
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      N° Commande
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Date
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Commande
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Fournisseur
                    </th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">
                      Articles
                    </th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">
                      Qté
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Statut
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Date prévue
                    </th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">
                      Destination
                    </th>
                    <th className="px-4 py-1.5 text-center text-xs font-medium bg-white w-12">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders?.map((order) => {
                    const totalQty = getOrderTotalQty(order);
                    const receivedQty = getOrderReceivedQty(order);

                    return (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="border-b border-[--k-border] cursor-pointer hover:bg-[--k-surface-2]/30 transition-colors"
                      >
                        <td className="px-4 py-1.5">
                          <span className="font-mono text-xs font-medium text-[--k-primary]">
                            {order.orderNumber}
                          </span>
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[--k-muted]" />
                            <span className="text-[--k-text]">
                              {formatDate(order.orderDate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="font-medium text-[--k-text]">
                            {getOrderLabel(order)}
                          </span>
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-[--k-muted]" />
                            <RouterLink
                              to={`/suppliers/${order.supplierId}`}
                              className="text-[--k-primary] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {order.supplier.name}
                            </RouterLink>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-center text-[--k-muted]">
                          {order.items?.length || 0}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span className="font-bold text-[--k-text]">
                            {totalQty}
                          </span>
                          {receivedQty > 0 && receivedQty !== totalQty && (
                            <span className="ml-1 text-xs text-[--k-muted]">
                              (reçu: {receivedQty})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            {getStatusBadge(order.status)}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {formatDate(order.expectedDate)}
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {order.destinationSite?.name || '-'}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <ActionsDropdown order={order} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Desktop Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
            <span>{filteredOrders?.length || 0} résultat{(filteredOrders?.length || 0) > 1 ? 's' : ''}</span>
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => updateParams({ page: String(p) })}
              totalItems={pagination.total}
            />
          </div>
        )}
      </div>

      {/* Create / Duplicate Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setDuplicateOrder(undefined); }}
        title={duplicateOrder ? 'Dupliquer la commande' : 'Nouvelle commande'}
        size="lg"
      >
        <OrderForm
          key={duplicateOrder?.id || 'new'}
          duplicateFrom={duplicateOrder}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setDuplicateOrder(undefined);
            refetch();
            toast.success(
              duplicateOrder ? 'Commande dupliquée' : 'Commande créée',
              'La commande a été enregistrée avec succès'
            );
          }}
          onCancel={() => { setIsCreateModalOpen(false); setDuplicateOrder(undefined); }}
        />
      </Modal>

      {/* Template Picker Modal */}
      <Modal
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        title="Créer à partir d'un modèle"
        size="md"
      >
        <div className="space-y-3">
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
              <span className="ml-2 text-[--k-muted]">Chargement...</span>
            </div>
          ) : !templatesData?.length ? (
            <div className="py-8 text-center text-[--k-muted]">
              <FileText className="mx-auto mb-2 h-8 w-8 text-[--k-muted]" />
              <p>Aucun modèle enregistré</p>
              <p className="mt-1 text-xs">
                Créez un modèle depuis la page détail d'une commande
              </p>
            </div>
          ) : (
            templatesData.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  // Convertir le template en objet Order-like pour duplicateFrom
                  const orderFromTemplate = {
                    supplierId: template.supplierId,
                    supplier: template.supplier,
                    destinationSiteId: template.destinationSiteId,
                    destinationSite: template.destinationSite,
                    responsible: template.responsible,
                    comment: template.comment,
                    title: template.name,
                    items: template.items.map((item) => ({
                      productId: item.productId,
                      product: item.product,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                    })),
                    id: '',
                    orderNumber: '',
                    status: 'PENDING' as const,
                    orderDate: '',
                    createdAt: '',
                    updatedAt: '',
                  } as Order;
                  setIsTemplatePickerOpen(false);
                  setDuplicateOrder(orderFromTemplate);
                  setIsCreateModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-[--k-border] bg-[--k-surface] p-3 text-left transition-colors hover:border-[--k-primary] hover:bg-indigo-50/50"
              >
                <div className="rounded-lg bg-indigo-100 p-2 text-[--k-primary]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[--k-text] truncate">
                    {template.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[--k-muted]">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {template.supplier?.name}
                    </span>
                    <span>·</span>
                    <span>{template.items?.length || 0} article{(template.items?.length || 0) > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <Hash className="h-4 w-4 text-[--k-muted]" />
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
