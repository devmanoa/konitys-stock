import { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Package,
  Truck,
  MapPin,
  Calendar,
  Link,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  ExternalLink,
  ZoomIn,
  Download,
  X,
  AlertTriangle,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ProductForm from '../components/forms/ProductForm';
import ProductSupplierForm from '../components/forms/ProductSupplierForm';
import MovementForm from '../components/forms/MovementForm';
import Comments from '../components/ProductComments';
import api from '../services/api';
import type { Product, ApiResponse } from '../types';

// Helper to get full image URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';
const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product>>(`/products/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const getRiskBadge = (risk?: string) => {
    if (!risk) return <Badge>Non défini</Badge>;
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

  const getTotalStock = () => {
    if (!data?.stocks) return { total: 0, neuf: 0, occasion: 0 };
    return data.stocks.reduce(
      (acc, s) => ({
        total: acc.total + s.quantityNew + s.quantityUsed,
        neuf: acc.neuf + s.quantityNew,
        occasion: acc.occasion + s.quantityUsed,
      }),
      { total: 0, neuf: 0, occasion: 0 }
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case 'OUT':
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case 'TRANSFER':
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
        <span className="ml-2 text-[--k-muted]">Chargement...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Produit non trouvé</p>
        <Button variant="secondary" onClick={() => navigate('/products')} className="mt-4">
          Retour aux produits
        </Button>
      </div>
    );
  }

  const stockInfo = getTotalStock();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <ArrowLeft
              className="h-5 w-5 shrink-0 cursor-pointer text-[--k-muted] hover:text-[--k-text] transition-colors"
              onClick={() => navigate(-1)}
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[--k-text] truncate">{data.description || data.reference}</h1>
              {data.reference !== (data.description || data.reference) && (
                <p className="mt-0.5 text-sm text-[--k-muted]">{data.reference}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={() => setIsMovementModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Mouvement
            </Button>
            <Button variant="secondary" onClick={() => setIsSupplierModalOpen(true)}>
              <Link className="mr-2 h-4 w-4" />
              Fournisseurs
            </Button>
            <Button onClick={() => setIsEditModalOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informations principales */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div
                className="group relative shrink-0 self-stretch overflow-hidden rounded-lg border border-[--k-border] bg-[--k-surface-2] cursor-zoom-in"
                onClick={() => data.imageUrl && setIsImageOpen(true)}
              >
                <img
                  src={getFullImageUrl(data.imageUrl)}
                  alt={data.reference}
                  className="h-full w-48 object-contain"
                />
                {data.imageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-4 content-start">
                <div>
                  <dt className="text-[13px] font-medium text-[--k-muted]">Référence</dt>
                  <dd className="mt-1 text-[--k-text]">{data.reference}</dd>
                </div>
                <div>
                  <dt className="text-[13px] font-medium text-[--k-muted]">Quantité par unité</dt>
                  <dd className="mt-1 text-[--k-text]">{data.qtyPerUnit}</dd>
                </div>
                {data.supplyRisk && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Risque approvisionnement</dt>
                    <dd className="mt-1">{getRiskBadge(data.supplyRisk)}</dd>
                  </div>
                )}
                {data.location && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Emplacement</dt>
                    <dd className="mt-1 text-[--k-text]">{data.location}</dd>
                  </div>
                )}
                {data.assembly?.name && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Borne</dt>
                    <dd className="mt-1 text-[--k-text]">{data.assembly.name}</dd>
                  </div>
                )}
                {data.assemblyType?.name && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Type borne</dt>
                    <dd className="mt-1 text-[--k-text]">{data.assemblyType.name}</dd>
                  </div>
                )}
                {data.minStock != null && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Seuil critique</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span className="text-[--k-text]">{data.minStock}</span>
                      {stockInfo.total <= data.minStock && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          Stock bas
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {data.createdAt && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Produit créé le</dt>
                    <dd className="mt-1 text-[--k-text]">
                      {new Date(data.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
                {data.partCategories && data.partCategories.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-[13px] font-medium text-[--k-muted]">Catégories de pièces</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {data.partCategories.map((pc) => (
                        <span
                          key={pc.id}
                          className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
                        >
                          {pc.partCategory.name}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {data.comment && (
                  <div className="col-span-2">
                    <dt className="text-[13px] font-medium text-[--k-muted]">Commentaire</dt>
                    <dd className="mt-1 text-[--k-text]">{data.comment}</dd>
                  </div>
                )}
              </dl>
            </div>
          </CardContent>
        </Card>

        {/* Stock resume */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-[--k-primary]">{stockInfo.total}</p>
                <p className="text-[13px] text-[--k-muted]">Total en stock</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[--k-border] pt-4">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-green-600">{stockInfo.neuf}</p>
                  <p className="text-xs text-[--k-muted]">Neuf</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-orange-600">{stockInfo.occasion}</p>
                  <p className="text-xs text-[--k-muted]">Occasion</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fournisseurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fournisseurs ({data.productSuppliers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.productSuppliers?.length ? (
            <p className="text-[--k-muted]">Aucun fournisseur lié</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2">Fournisseur</th>
                    <th className="pb-2">Ref. fournisseur</th>
                    <th className="pb-2">Prix HT</th>
                    <th className="pb-2">Délai</th>
                    <th className="pb-2">Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.productSuppliers.map((ps) => (
                    <tr key={ps.id}>
                      <td className="py-2 font-medium">
                        <RouterLink
                          to={`/suppliers/${ps.supplier.id}`}
                          className="text-[--k-primary] hover:underline"
                        >
                          {ps.supplier.name}
                        </RouterLink>
                      </td>
                      <td className="py-2 text-[--k-muted]">{ps.supplierRef || '-'}</td>
                      <td className="py-2 text-[--k-muted]">
                        {ps.unitPrice ? `${Number(ps.unitPrice).toFixed(2)} \u20AC` : '-'}
                      </td>
                      <td className="py-2 text-[--k-muted]">{ps.leadTime || '-'}</td>
                      <td className="py-2">
                        {ps.isPrimary && (
                          <Badge variant="warning">Principal</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock par site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Stock par site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.stocks?.length ? (
            <p className="text-[--k-muted]">Aucun stock enregistré</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2">Site</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Neuf</th>
                    <th className="pb-2 text-right">Occasion</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.stocks.map((stock) => (
                    <tr key={stock.id}>
                      <td className="py-2 font-medium text-[--k-text]">{stock.site.name}</td>
                      <td className="py-2">
                        <Badge variant={stock.site.type === 'STORAGE' ? 'success' : 'default'}>
                          {stock.site.type === 'STORAGE' ? 'Stockage' : 'Sortie'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-green-600">{stock.quantityNew}</td>
                      <td className="py-2 text-right text-orange-600">{stock.quantityUsed}</td>
                      <td className="py-2 text-right font-medium text-[--k-text]">
                        {stock.quantityNew + stock.quantityUsed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Derniers mouvements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique des mouvements
          </CardTitle>
          <RouterLink to={`/movements?productId=${id}`}>
            <Button variant="ghost" size="sm">
              Voir tout
              <ExternalLink className="ml-1 h-4 w-4" />
            </Button>
          </RouterLink>
        </CardHeader>
        <CardContent>
          {!data.movements?.length ? (
            <div className="text-center py-8">
              <p className="text-[--k-muted] mb-4">Aucun mouvement enregistré</p>
              <Button variant="secondary" onClick={() => setIsMovementModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Créer un mouvement
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Destination</th>
                    <th className="pb-2">État</th>
                    <th className="pb-2 text-right">Quantité</th>
                    <th className="pb-2">Opérateur</th>
                    <th className="pb-2">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.movements.map((mvt) => (
                    <tr key={mvt.id} className="hover:bg-[--k-surface-2]">
                      <td className="py-2 text-[--k-muted]">
                        <div className="flex flex-col">
                          <span>{new Date(mvt.movementDate).toLocaleDateString('fr-FR')}</span>
                          <span className="text-xs">
                            {new Date(mvt.movementDate).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(mvt.type)}
                          <Badge
                            variant={
                              mvt.type === 'IN' ? 'success' : mvt.type === 'OUT' ? 'danger' : 'info'
                            }
                          >
                            {mvt.type === 'IN' ? 'Entrée' : mvt.type === 'OUT' ? 'Sortie' : 'Transfert'}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2 text-[--k-muted]">{mvt.sourceSite?.name || '-'}</td>
                      <td className="py-2 text-[--k-muted]">{mvt.targetSite?.name || '-'}</td>
                      <td className="py-2">
                        <Badge variant={mvt.condition === 'NEW' ? 'success' : 'warning'}>
                          {mvt.condition === 'NEW' ? 'Neuf' : 'Occasion'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${
                          mvt.type === 'IN'
                            ? 'text-green-600'
                            : mvt.type === 'OUT'
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}>
                          {mvt.type === 'IN' ? '+' : mvt.type === 'OUT' ? '-' : ''}
                          {mvt.quantity}
                        </span>
                      </td>
                      <td className="py-2 text-[--k-muted]">{mvt.operator || '-'}</td>
                      <td className="py-2 text-[--k-muted]">
                        {mvt.comment ? (
                          <span className="truncate max-w-[100px] block" title={mvt.comment}>
                            {mvt.comment}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.movements.length >= 10 && (
                <div className="mt-4 text-center">
                  <RouterLink to={`/movements?productId=${id}`}>
                    <Button variant="ghost" size="sm">
                      Voir tous les mouvements
                      <ExternalLink className="ml-1 h-4 w-4" />
                    </Button>
                  </RouterLink>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commentaires */}
      <Comments entityType="products" entityId={id!} />

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modifier le produit"
        size="lg"
      >
        <ProductForm
          product={data}
          onSuccess={() => {
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['product', id] });
          }}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Supplier Management Modal */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={`Fournisseurs - ${data.reference}`}
        size="lg"
      >
        <ProductSupplierForm
          product={data}
          onClose={() => setIsSupplierModalOpen(false)}
        />
      </Modal>

      {/* Movement Modal */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        title={`Nouveau mouvement - ${data.reference}`}
        size="lg"
      >
        <MovementForm
          preselectedProductId={id}
          preselectedProduct={data}
          onSuccess={() => {
            setIsMovementModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['product', id] });
          }}
          onCancel={() => setIsMovementModalOpen(false)}
        />
      </Modal>

      {/* Image Lightbox */}
      {isImageOpen && data.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setIsImageOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getFullImageUrl(data.imageUrl)}
              alt={data.reference}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain bg-white p-4"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a
                href={getFullImageUrl(data.imageUrl)}
                download={`${data.reference}.png`}
                className="rounded-lg bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                title="Télécharger"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                onClick={() => setIsImageOpen(false)}
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
