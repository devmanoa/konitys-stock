import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, MapPin, Filter, ArrowUpDown, ChevronDown, ChevronUp, ZoomIn, Download, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SearchSelect from '../components/ui/SearchSelect';
import { KpiCard } from '../components/KpiCard';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import { formatStockBreakdown } from '../utils/stockFormat';
import type { Stock, Site, Product, ApiResponse, AssemblyType, PaginatedResponse, Assembly } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

interface ProductWithAssembly extends Product {
  assembly?: Assembly;
  assemblyType?: AssemblyType;
}

interface StockWithDetails extends Stock {
  product: ProductWithAssembly;
  site: Site;
}

interface MatrixRow {
  product: ProductWithAssembly;
  stocks: Map<string, { quantityNew: number; quantityUsed: number }>;
  totalNew: number;
  totalUsed: number;
  total: number;
}

type SortField = 'reference' | 'totalNew' | 'totalUsed' | 'total';
type SortOrder = 'asc' | 'desc';

export default function Stocks() {
  const [search, setSearch] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedAssemblyType, setSelectedAssemblyType] = useState('');
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [sortField, setSortField] = useState<SortField>('reference');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [lightboxProduct, setLightboxProduct] = useState<ProductWithAssembly | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<string>(''); // YYYY-MM-DD ; empty = live mode

  // Fetch stocks (live or historical snapshot depending on snapshotDate)
  const { data: stocksData, isLoading: stocksLoading } = useQuery({
    queryKey: ['stocks', snapshotDate || 'live'],
    queryFn: async () => {
      const url = snapshotDate
        ? `/stocks/snapshot?date=${encodeURIComponent(snapshotDate)}`
        : '/stocks';
      const res = await api.get<ApiResponse<StockWithDetails[]>>(url);
      return res.data?.data;
    },
  });

  // Fetch sites for filter and matrix columns
  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data;
    },
  });

  // Fetch assembly types for filter
  const { data: assemblyTypesData } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<AssemblyType>>('/assembly-types?limit=100');
      return res.data?.data || [];
    },
  });

  // Fetch assemblies for filter
  const { data: assembliesData } = useQuery({
    queryKey: ['assemblies'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Assembly>>('/assemblies?limit=100');
      return res.data?.data || [];
    },
  });

  // Filter assemblies by selected type
  const filteredAssemblies = selectedAssemblyType
    ? assembliesData?.filter((assembly) =>
        assembly.assemblyTypes?.some((at: any) =>
          at.assemblyTypeId === selectedAssemblyType || at.id === selectedAssemblyType
        )
      )
    : assembliesData;

  // Site IDs that actually hold stock anywhere
  const activeSiteIds = useMemo(() => {
    const ids = new Set<string>();
    (stocksData || []).forEach((stock) => {
      if ((stock.quantityNew || 0) + (stock.quantityUsed || 0) > 0) {
        ids.add(stock.siteId);
      }
    });
    return ids;
  }, [stocksData]);

  // Storage sites with at least one product in stock (for matrix columns)
  const storageSites = useMemo(() =>
    sites?.filter(s => s.type === 'STORAGE' && s.isActive && activeSiteIds.has(s.id)) || [],
    [sites, activeSiteIds]
  );

  // Build matrix data
  const matrixData = useMemo(() => {
    if (!stocksData) return [];

    const productMap = new Map<string, MatrixRow>();

    stocksData.forEach((stock) => {
      if (!productMap.has(stock.productId)) {
        productMap.set(stock.productId, {
          product: stock.product,
          stocks: new Map(),
          totalNew: 0,
          totalUsed: 0,
          total: 0,
        });
      }

      const row = productMap.get(stock.productId)!;
      row.stocks.set(stock.siteId, {
        quantityNew: stock.quantityNew,
        quantityUsed: stock.quantityUsed,
      });
      row.totalNew += stock.quantityNew;
      row.totalUsed += stock.quantityUsed;
      row.total += stock.quantityNew + stock.quantityUsed;
    });

    return Array.from(productMap.values());
  }, [stocksData]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let result = matrixData;

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (row) =>
          row.product.reference.toLowerCase().includes(searchLower) ||
          row.product.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by site (show only products with stock in selected site)
    if (selectedSite) {
      result = result.filter((row) => {
        const siteStock = row.stocks.get(selectedSite);
        return siteStock && (siteStock.quantityNew > 0 || siteStock.quantityUsed > 0);
      });
    }

    // Filter by assembly type
    if (selectedAssemblyType) {
      result = result.filter((row) => {
        return (row.product.assemblyTypes || []).some(
          (l: any) => l.assemblyTypeId === selectedAssemblyType,
        );
      });
    }

    // Filter by assembly
    if (selectedAssembly) {
      result = result.filter((row) => {
        return row.product.assemblyId === selectedAssembly;
      });
    }

    // Filter zero stock products
    if (!showZeroStock) {
      result = result.filter((row) => row.total > 0);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'reference':
          comparison = a.product.reference.localeCompare(b.product.reference);
          break;
        case 'totalNew':
          comparison = a.totalNew - b.totalNew;
          break;
        case 'totalUsed':
          comparison = a.totalUsed - b.totalUsed;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [matrixData, search, selectedSite, selectedAssemblyType, selectedAssembly, showZeroStock, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    return (
      <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
    );
  };

  // Calculate site totals
  const siteTotals = useMemo(() => {
    const totals = new Map<string, { totalNew: number; totalUsed: number }>();
    storageSites.forEach((site) => totals.set(site.id, { totalNew: 0, totalUsed: 0 }));

    filteredData.forEach((row) => {
      row.stocks.forEach((stock, siteId) => {
        const current = totals.get(siteId);
        if (current) {
          current.totalNew += stock.quantityNew;
          current.totalUsed += stock.quantityUsed;
        }
      });
    });

    return totals;
  }, [filteredData, storageSites]);

  // Storage sites sorted by total stock desc (so site with most stock shows first)
  const sortedStorageSites = useMemo(() => {
    return [...storageSites].sort((a, b) => {
      const ta = siteTotals.get(a.id);
      const tb = siteTotals.get(b.id);
      const va = (ta?.totalNew || 0) + (ta?.totalUsed || 0);
      const vb = (tb?.totalNew || 0) + (tb?.totalUsed || 0);
      return vb - va;
    });
  }, [storageSites, siteTotals]);

  const grandTotal = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        totalNew: acc.totalNew + row.totalNew,
        totalUsed: acc.totalUsed + row.totalUsed,
        total: acc.total + row.total,
      }),
      { totalNew: 0, totalUsed: 0, total: 0 }
    );
  }, [filteredData]);

  const renderStockCell = (quantityNew: number, quantityUsed: number) => {
    const total = quantityNew + quantityUsed;
    return (
      <span className={total === 0 ? 'text-[--k-muted]' : 'font-medium text-[--k-text]'}>
        {formatStockBreakdown(quantityNew, quantityUsed)}
      </span>
    );
  };

  const toggleRowExpand = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  // Mobile card component for stocks
  const StockCard = ({ row }: { row: MatrixRow }) => {
    const isExpanded = expandedRows.has(row.product.id);

    return (
      <div className="rounded-2xl border border-[--k-border] bg-[--k-surface]">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => row.product.imageUrl && setLightboxProduct(row.product)}
              disabled={!row.product.imageUrl}
              className={`group relative h-[5rem] w-[5rem] flex-shrink-0 overflow-hidden rounded-lg bg-[--k-surface-2] ${row.product.imageUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
            >
              <img
                src={getFullImageUrl(row.product.imageUrl)}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE; }}
              />
              {row.product.imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <Link
                to={`/products/${row.product.id}`}
                className="text-[16px] font-medium text-[--k-primary] hover:text-indigo-700"
              >
                {row.product.description || row.product.reference}
              </Link>
              <p className="text-[15px] text-[--k-muted] font-mono mt-0.5">
                {row.product.reference}
              </p>
              {row.product.supplyRisk && (
                <Badge
                  variant={
                    row.product.supplyRisk === 'HIGH'
                      ? 'danger'
                      : row.product.supplyRisk === 'MEDIUM'
                      ? 'warning'
                      : 'success'
                  }
                  className="mt-1"
                >
                  {row.product.supplyRisk === 'HIGH'
                    ? 'Risque fort'
                    : row.product.supplyRisk === 'MEDIUM'
                    ? 'Risque moyen'
                    : 'Risque faible'}
                </Badge>
              )}
            </div>
          </div>

          {/* Stock summary */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[--k-surface-2] p-2">
              <p className="text-xs text-[--k-muted]">Total</p>
              <p className="text-lg font-bold text-[--k-text]">{row.total}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2">
              <p className="text-xs text-green-600">Neuf</p>
              <p className="text-lg font-bold text-green-600">{row.totalNew}</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-2">
              <p className="text-xs text-orange-600">Occasion</p>
              <p className="text-lg font-bold text-orange-600">{row.totalUsed}</p>
            </div>
          </div>


          {/* Expand/collapse button for site details */}
          {storageSites.length > 0 && (
            <button
              onClick={() => toggleRowExpand(row.product.id)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[--k-border] py-2 text-sm text-[--k-muted] hover:bg-[--k-surface-2]"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Masquer les détails par site
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Voir les détails par site
                </>
              )}
            </button>
          )}
        </div>

        {/* Expanded site details */}
        {isExpanded && (
          <div className="border-t border-[--k-border] p-4">
            <div className="space-y-2">
              {sortedStorageSites.map((site) => {
                const siteStock = row.stocks.get(site.id);
                const siteTotal = (siteStock?.quantityNew || 0) + (siteStock?.quantityUsed || 0);
                if (siteTotal === 0) return null;

                return (
                  <div
                    key={site.id}
                    className="flex items-center justify-between rounded-lg bg-[--k-surface-2] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[--k-text]">
                      {site.name}
                    </span>
                    <span className="text-sm font-medium text-[--k-text]">
                      {formatStockBreakdown(siteStock?.quantityNew || 0, siteStock?.quantityUsed || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestion des Stocks"
        subtitle="Vue matricielle des stocks par produit et par site"
      >
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-[--k-muted] whitespace-nowrap">
            <span className="hidden sm:inline whitespace-nowrap">Stock à la date :</span>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input-field !py-1 !px-2"
            />
          </label>
          {snapshotDate && (
            <Button variant="ghost" size="sm" onClick={() => setSnapshotDate('')}>
              <X className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Temps réel</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {snapshotDate && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-semibold">Mode historique</span>
          <span>—</span>
          <span>
            Stock reconstruit au {new Date(snapshotDate).toLocaleDateString('fr-FR')} en fin de journée.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Produits" value={filteredData.length} icon={Package} colorIndex={0} />
        <KpiCard title="Stock neuf" value={grandTotal.totalNew} icon={Package} colorIndex={2} />
        <KpiCard title="Occasion" value={grandTotal.totalUsed} icon={Package} colorIndex={4} />
        <KpiCard title="Sites" value={storageSites.length} icon={MapPin} colorIndex={5} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search */}
          <div className="relative min-w-[140px] sm:w-[352px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          {/* Filters - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <SearchSelect
              value={selectedSite}
              onChange={(val) => setSelectedSite(val)}
              options={storageSites.map((site) => ({ value: site.id, label: site.name }))}
              placeholder="Tous sites"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={selectedAssemblyType}
              onChange={(val) => {
                setSelectedAssemblyType(val);
                setSelectedAssembly('');
              }}
              options={assemblyTypesData?.filter((at) => at && at.id && at.name).map((at) => ({ value: at.id, label: at.name })) || []}
              placeholder="Type borne"
              className="min-w-[140px] sm:w-[352px]"
            />
            <SearchSelect
              value={selectedAssembly}
              onChange={(val) => setSelectedAssembly(val)}
              options={filteredAssemblies?.filter((a) => a && a.id && a.name).map((a) => ({ value: a.id, label: a.name })) || []}
              placeholder="Borne"
              className="min-w-[140px] sm:w-[352px]"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[--k-muted] whitespace-nowrap">
              <input
                type="checkbox"
                checked={showZeroStock}
                onChange={(e) => setShowZeroStock(e.target.checked)}
                className="h-4 w-4 rounded border-[--k-border] text-[--k-primary] focus:ring-[--k-primary]"
              />
              <span className="hidden sm:inline">Afficher stocks à zéro</span>
              <span className="sm:hidden">Stock 0</span>
            </label>

            {(search || selectedSite || selectedAssemblyType || selectedAssembly || showZeroStock) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedSite('');
                  setSelectedAssemblyType('');
                  setSelectedAssembly('');
                  setShowZeroStock(false);
                }}
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </Button>
            )}
          </div>
        </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden">
        {stocksLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-8 text-center text-[--k-muted]">
            Aucun produit trouvé
          </div>
        ) : (
          <div className="space-y-3">
            {filteredData.map((row) => (
              <StockCard key={row.product.id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop Matrix Table */}
      <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
        {stocksLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
            <span className="ml-2 text-[--k-muted]">Chargement...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-12 text-center text-[--k-muted]">
            Aucun produit trouvé
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
              <div className="text-lg font-semibold text-[--k-text]">Stock matriciel</div>
              <div className="text-xs text-[--k-muted]">{filteredData.length} types de produits</div>
            </div>
            <div>
              <table className="w-full text-[13px]">
                <thead className="sticky -top-5 z-20">
                  <tr className="border-b border-[--k-border] bg-white">
                    <th className="sticky left-0 z-30 bg-white px-4 py-1.5 text-left">
                      <button
                        onClick={() => handleSort('reference')}
                        className="flex items-center gap-1 font-semibold text-[--k-text] hover:text-[--k-text]"
                      >
                        Produit
                        {getSortIcon('reference')}
                      </button>
                    </th>
                    <th className="bg-white px-3 py-1.5 text-left text-xs font-medium text-[--k-muted]">
                      Borne
                    </th>
                    <th className="bg-white px-3 py-1.5 text-center">
                      <button
                        onClick={() => handleSort('total')}
                        className="flex items-center gap-1 font-semibold text-[--k-text] hover:text-[--k-text]"
                      >
                        Total
                        {getSortIcon('total')}
                      </button>
                    </th>
                    <th className="bg-white px-3 py-1.5 text-center">
                      <button
                        onClick={() => handleSort('totalNew')}
                        className="flex items-center gap-1 font-semibold text-green-700 hover:text-green-900"
                      >
                        Neuf
                        {getSortIcon('totalNew')}
                      </button>
                    </th>
                    <th className="bg-white px-3 py-1.5 text-center">
                      <button
                        onClick={() => handleSort('totalUsed')}
                        className="flex items-center gap-1 font-semibold text-orange-700 hover:text-orange-900"
                      >
                        Occasion
                        {getSortIcon('totalUsed')}
                      </button>
                    </th>
                    {sortedStorageSites.map((site) => (
                      <th
                        key={site.id}
                        className="bg-white px-3 py-1.5 text-center text-xs font-medium text-[--k-muted]"
                      >
                        <div className="flex flex-col items-center">
                          <span>{site.name}</span>
                          <span className="text-xs font-normal text-[--k-muted]">
                            {(siteTotals.get(site.id)?.totalNew || 0) +
                              (siteTotals.get(site.id)?.totalUsed || 0)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row) => (
                    <tr
                      key={row.product.id}
                      className="border-b border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => row.product.imageUrl && setLightboxProduct(row.product)}
                            disabled={!row.product.imageUrl}
                            className={`group relative h-[5rem] w-[5rem] flex-shrink-0 overflow-hidden rounded-lg bg-[--k-surface-2] ${row.product.imageUrl ? 'cursor-zoom-in' : 'cursor-default'}`}
                          >
                            <img
                              src={getFullImageUrl(row.product.imageUrl)}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE; }}
                            />
                            {row.product.imageUrl && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </button>
                          <div className="flex flex-col min-w-0">
                            <Link
                              to={`/products/${row.product.id}`}
                              className="text-[16px] font-medium text-[--k-primary] hover:underline truncate max-w-[250px]"
                            >
                              {row.product.description || row.product.reference}
                            </Link>
                            <span className="text-[15px] text-[--k-muted] font-mono">
                              {row.product.reference}
                            </span>
                            {row.product.supplyRisk && (
                              <Badge
                                variant={
                                  row.product.supplyRisk === 'HIGH'
                                    ? 'danger'
                                    : row.product.supplyRisk === 'MEDIUM'
                                    ? 'warning'
                                    : 'success'
                                }
                                className="mt-1 w-fit"
                              >
                                {row.product.supplyRisk === 'HIGH'
                                  ? 'Risque fort'
                                  : row.product.supplyRisk === 'MEDIUM'
                                  ? 'Risque moyen'
                                  : 'Risque faible'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-col">
                          {(row.product.assemblyTypes || []).length > 0 && (
                            <span className="text-xs text-[--k-primary]">
                              {(row.product.assemblyTypes || []).map((l: any) => l.assemblyType.name).join(', ')}
                            </span>
                          )}
                          {row.product.assembly && (
                            <span className="text-[--k-text]">
                              {row.product.assembly.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center font-bold text-[--k-text]">
                        {row.total}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-green-600">
                        {row.totalNew}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-orange-600">
                        {row.totalUsed}
                      </td>
                      {sortedStorageSites.map((site) => {
                        const siteStock = row.stocks.get(site.id);
                        return (
                          <td key={site.id} className="px-3 py-1.5 text-center">
                            {renderStockCell(
                              siteStock?.quantityNew || 0,
                              siteStock?.quantityUsed || 0
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[--k-border] bg-[--k-surface-2] font-semibold">
                    <td className="sticky left-0 z-10 bg-[--k-surface-2] px-4 py-1.5">
                      Total
                    </td>
                    <td className="bg-[--k-surface-2] px-3 py-1.5"></td>
                    <td className="px-3 py-1.5 text-center font-bold text-[--k-text]">
                      {grandTotal.total}
                    </td>
                    <td className="px-3 py-1.5 text-center text-green-600">
                      {grandTotal.totalNew}
                    </td>
                    <td className="px-3 py-1.5 text-center text-orange-600">
                      {grandTotal.totalUsed}
                    </td>
                    {sortedStorageSites.map((site) => {
                      const siteTotal = siteTotals.get(site.id);
                      return (
                        <td key={site.id} className="px-3 py-1.5 text-center">
                          {renderStockCell(
                            siteTotal?.totalNew || 0,
                            siteTotal?.totalUsed || 0
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[--k-border] px-4 py-2 text-xs text-[--k-muted]">
              <span>{filteredData.length} produit{filteredData.length > 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>

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
