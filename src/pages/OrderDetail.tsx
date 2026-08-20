import { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Truck,
  MapPin,
  Package,
  PackageCheck,
  User,
  Hash,
  MessageSquare,
  FileText,
  ExternalLink,
  BookmarkPlus,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ReceiveOrderForm from '../components/forms/ReceiveOrderForm';
import ReceiveAllForm from '../components/forms/ReceiveAllForm';
import { useToast } from '../components/ui/Toast';
import Comments from '../components/ProductComments';
import RichTextDisplay from '../components/ui/RichTextDisplay';
import OrderAttachments from '../components/OrderAttachments';
import OrderAuditTimeline from '../components/OrderAuditTimeline';
import api from '../services/api';
import OperatorAvatar from '../components/OperatorAvatar';
import { formatDate as formatDateUtil, formatDateTime } from '../utils/date';
import { getStatusBadge } from '../utils/orderDisplay';
import type { Order, OrderItem, ApiResponse } from '../types';
import Spinner from '../components/ui/Spinner'

// Cette page affiche '—' (tiret cadratin) pour les dates absentes.
const formatDate = (dateStr?: string | null) => formatDateUtil(dateStr, '—');

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [receiveItem, setReceiveItem] = useState<{ orderId: string; itemId: string } | null>(null);
  const [isReceiveAllOpen, setIsReceiveAllOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const saveTemplateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post('/order-templates', {
        name,
        supplierId: data!.supplierId,
        destinationSiteId: data!.destinationSiteId || undefined,
        responsible: data!.responsible || undefined,
        comment: data!.comment || undefined,
        items: data!.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice || undefined,
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      setIsSaveTemplateOpen(false);
      setTemplateName('');
      toast.success('Modèle sauvegardé', 'Le modèle de commande a été créé');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Erreur lors de la sauvegarde';
      toast.error('Erreur', msg);
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const getItemStatusBadge = (item: OrderItem) => {
    if (item.receivedQty !== null && item.receivedQty !== undefined) {
      return <Badge variant="success">Reçu ({item.receivedQty})</Badge>;
    }
    return <Badge variant="warning">En attente</Badge>;
  };

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
  };

  if (isLoading) {
    return (
      <Spinner size="lg" label="Chargement..." className="py-12" />
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Commande non trouvée</p>
        <Button variant="secondary" onClick={() => navigate('/orders')} className="mt-4">
          Retour aux commandes
        </Button>
      </div>
    );
  }

  const totalQty = data.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const receivedQty = data.items?.reduce((s, i) => s + (i.receivedQty || 0), 0) || 0;
  const estimatedTotal = data.items?.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0) || 0;
  const isReceivable = data.status === 'PENDING' || data.status === 'PARTIAL';
  const hasPendingItems = isReceivable && data.items?.some((i) => i.receivedQty === null || i.receivedQty === undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[--k-text]">
                {data.orderNumber}
              </h1>
              {getStatusBadge(data.status)}
            </div>
            {data.title && (
              <p className="text-[--k-muted] mt-1">{data.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingItems && (
            <Button
              size="sm"
              onClick={() => setIsReceiveAllOpen(true)}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Tout réceptionner</span>
              <span className="sm:hidden">Réceptionner</span>
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTemplateName(data.title || `Modèle - ${data.supplier?.name || ''}`);
              setIsSaveTemplateOpen(true);
            }}
          >
            <BookmarkPlus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sauvegarder comme modèle</span>
            <span className="sm:hidden">Modèle</span>
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Information card - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  N° de commande
                </dt>
                <dd className="mt-1 text-sm text-[--k-text] font-mono">
                  {data.orderNumber}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Fournisseur
                </dt>
                <dd className="mt-1 text-sm">
                  <RouterLink
                    to={`/suppliers/${data.supplierId}`}
                    className="text-[--k-primary] hover:text-indigo-700 flex items-center gap-1"
                  >
                    {data.supplier?.name}
                    <ExternalLink className="h-3 w-3" />
                  </RouterLink>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Date de commande
                </dt>
                <dd className="mt-1 text-sm text-[--k-text]">
                  {formatDate(data.orderDate)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Date de réception prévue
                </dt>
                <dd className="mt-1 text-sm text-[--k-text]">
                  {formatDate(data.expectedDate)}
                </dd>
              </div>

              {data.receivedDate && (
                <div>
                  <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                    <PackageCheck className="h-3.5 w-3.5" />
                    Date de réception effective
                  </dt>
                  <dd className="mt-1 text-sm text-emerald-600 font-medium flex items-center gap-2 flex-wrap">
                    <span>{formatDate(data.receivedDate)}</span>
                    {data.expectedDate && (() => {
                      const expected = new Date(data.expectedDate).getTime()
                      const received = new Date(data.receivedDate).getTime()
                      const days = Math.round((received - expected) / (1000 * 60 * 60 * 24))
                      if (days === 0) {
                        return (
                          <span className="text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                            À l'heure
                          </span>
                        )
                      }
                      // Bucket the lateness magnitude: small delay = orange, big delay = red
                      const cls =
                        days > 0
                          ? days <= 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      const sign = days > 0 ? '+' : ''
                      const label = days > 0 ? 'retard' : 'avance'
                      return (
                        <span
                          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${cls}`}
                          title={`Différence entre réception effective et prévue`}
                        >
                          {sign}{days} j ({label})
                        </span>
                      )
                    })()}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Site de destination
                </dt>
                <dd className="mt-1 text-sm text-[--k-text]">
                  {data.destinationSite?.name || '—'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Responsable
                </dt>
                <dd className="mt-1 text-sm">
                  <OperatorAvatar name={data.responsible} size="md" />
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Créé par
                </dt>
                <dd className="mt-1 text-sm">
                  <OperatorAvatar name={data.createdBy} size="md" />
                </dd>
              </div>

              {data.supplierRef && (
                <div>
                  <dt className="text-sm font-medium text-[--k-muted]">
                    Réf. fournisseur
                  </dt>
                  <dd className="mt-1 text-sm text-[--k-text] font-mono">
                    {data.supplierRef}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-[--k-muted] flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Date de création
                </dt>
                <dd className="mt-1 text-sm text-[--k-muted]">
                  {formatDateTime(data.createdAt)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Résumé
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[--k-muted]">Articles</span>
                <span className="text-lg font-semibold text-[--k-text]">
                  {data.items?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[--k-muted]">Quantité totale</span>
                <span className="text-lg font-semibold text-[--k-text]">
                  {totalQty}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[--k-muted]">Quantité reçue</span>
                <span className={`text-lg font-semibold ${receivedQty === totalQty && totalQty > 0 ? 'text-emerald-600' : 'text-[--k-text]'}`}>
                  {receivedQty}
                </span>
              </div>
              <div className="border-t border-[--k-border] pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[--k-muted]">Sous-total articles HT</span>
                  <span className="text-sm font-medium text-[--k-text]">
                    {formatPrice(estimatedTotal)}
                  </span>
                </div>
                {data.shippingCost != null && Number(data.shippingCost) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[--k-muted]">Frais de livraison</span>
                    <span className="text-sm font-medium text-[--k-text]">
                      {formatPrice(Number(data.shippingCost))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-[--k-border]">
                  <span className="text-sm font-medium text-[--k-muted]">Montant estimé HT</span>
                  <span className="text-lg font-bold text-[--k-text]">
                    {formatPrice(estimatedTotal + Number(data.shippingCost || 0))}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              {totalQty > 0 && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-[--k-muted] mb-1">
                    <span>Réception</span>
                    <span>{Math.round((receivedQty / totalQty) * 100)}%</span>
                  </div>
                  <div className="w-full bg-[--k-surface-2] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${receivedQty === totalQty ? 'bg-green-500' : 'bg-[--k-primary]'}`}
                      style={{ width: `${Math.min(100, (receivedQty / totalQty) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comment card */}
      {data.comment && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Commentaire
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextDisplay content={data.comment} className="text-sm" emptyFallback={null} />
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Articles commandés ({data.items?.length || 0})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile view */}
          <div className="block lg:hidden divide-y divide-[--k-border]">
            {data.items?.map((item) => (
              <div key={item.id} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <img
                    src={getFullImageUrl((item.product as any)?.imageUrl)}
                    alt=""
                    className="h-10 w-10 rounded object-cover bg-[--k-surface-2]"
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE; }}
                  />
                  <div className="flex-1 min-w-0">
                    <RouterLink
                      to={`/products/${item.productId}`}
                      className="text-sm font-medium text-[--k-primary] hover:text-indigo-700 truncate block"
                    >
                      {item.product?.description || item.product?.reference || 'Produit'}
                    </RouterLink>
                    <span className="text-xs text-[--k-muted] font-mono">
                      {item.product?.reference}
                    </span>
                  </div>
                  {getItemStatusBadge(item)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[--k-muted]">
                    Qté: {item.quantity} | Prix: {formatPrice(item.unitPrice)}
                  </span>
                  {isReceivable && (item.receivedQty === null || item.receivedQty === undefined) && (
                    <Button
                      size="sm"
                      onClick={() => setReceiveItem({ orderId: data.id, itemId: item.id })}
                    >
                      Réceptionner
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-[--k-border] table-zebra">
              <thead className="bg-gradient-to-r from-blue-50/60 to-indigo-50/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[--k-muted] uppercase">
                    Produit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[--k-muted] uppercase">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[--k-muted] uppercase">
                    Prix HT
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[--k-muted] uppercase">
                    Qté commandée
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[--k-muted] uppercase">
                    Qté reçue
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[--k-muted] uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[--k-muted] uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--k-border]">
                {data.items?.map((item) => (
                  <tr key={item.id} className="row-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getFullImageUrl((item.product as any)?.imageUrl)}
                          alt=""
                          className="h-8 w-8 rounded object-cover bg-[--k-surface-2]"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE; }}
                        />
                        <RouterLink
                          to={`/products/${item.productId}`}
                          className="text-sm font-medium text-[--k-primary] hover:text-indigo-700"
                        >
                          {item.product?.description || item.product?.reference || 'Produit'}
                        </RouterLink>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[--k-muted] font-mono">
                      {item.product?.reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[--k-text]">
                      {formatPrice(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[--k-text] font-medium">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[--k-text]">
                      {item.receivedQty !== null && item.receivedQty !== undefined ? item.receivedQty : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getItemStatusBadge(item)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isReceivable && (item.receivedQty === null || item.receivedQty === undefined) ? (
                        <Button
                          size="sm"
                          onClick={() => setReceiveItem({ orderId: data.id, itemId: item.id })}
                        >
                          Réceptionner
                        </Button>
                      ) : (
                        <span className="text-[--k-muted]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pièces jointes */}
      <OrderAttachments orderId={id!} />

      {/* Historique d'activité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Historique d'activité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderAuditTimeline orderId={id!} />
        </CardContent>
      </Card>

      {/* Commentaires */}
      <Comments entityType="orders" entityId={id!} />

      {/* Receive item modal */}
      {receiveItem && (
        <Modal
          isOpen={true}
          onClose={() => setReceiveItem(null)}
          title="Réceptionner un article"
          size="lg"
        >
          <ReceiveOrderForm
            orderId={receiveItem.orderId}
            itemId={receiveItem.itemId}
            onSuccess={() => {
              setReceiveItem(null);
              queryClient.invalidateQueries({ queryKey: ['order', id] });
              queryClient.invalidateQueries({ queryKey: ['orders'] });
              toast.success('Article réceptionné avec succès');
            }}
            onCancel={() => setReceiveItem(null)}
          />
        </Modal>
      )}

      {/* Receive all modal */}
      <Modal
        isOpen={isReceiveAllOpen}
        onClose={() => setIsReceiveAllOpen(false)}
        title="Réception globale"
      >
        <ReceiveAllForm
          order={data}
          onSuccess={() => {
            setIsReceiveAllOpen(false);
            queryClient.invalidateQueries({ queryKey: ['order', id] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            toast.success('Tous les articles ont été réceptionnés');
          }}
          onCancel={() => setIsReceiveAllOpen(false)}
        />
      </Modal>

      {/* Save as template modal */}
      <Modal
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        title="Sauvegarder comme modèle"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[--k-muted]">
            Ce modèle pourra être réutilisé pour créer rapidement de nouvelles commandes avec les mêmes produits.
          </p>
          <Input
            label="Nom du modèle"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex: Réappro mensuel composants"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsSaveTemplateOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => templateName.trim() && saveTemplateMutation.mutate(templateName.trim())}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
