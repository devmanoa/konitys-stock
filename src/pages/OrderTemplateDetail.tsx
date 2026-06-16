import { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Truck,
  MapPin,
  User,
  MessageSquare,
  Package,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import OrderTemplateEditForm from '../components/forms/OrderTemplateEditForm';
import OperatorAvatar from '../components/OperatorAvatar';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { OrderTemplate, ApiResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

export default function OrderTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['order-template', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OrderTemplate>>(`/order-templates/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/order-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-templates'] });
      toast.success('Modèle supprimé', 'Le modèle a été supprimé');
      navigate('/order-templates');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le modèle');
    },
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
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
        <p className="text-red-600">Modèle non trouvé</p>
        <Button variant="secondary" onClick={() => navigate('/order-templates')} className="mt-4">
          Retour aux modèles
        </Button>
      </div>
    );
  }

  const totalQty = data.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  const estimatedTotal = data.items?.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/order-templates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[--k-text]">
              {data.name}
            </h1>
            <p className="text-[--k-muted] mt-1 text-sm">Modèle de commande</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditOpen(true)}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Supprimer</span>
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
                  <FileText className="h-3.5 w-3.5" />
                  Nom du modèle
                </dt>
                <dd className="mt-1 text-sm text-[--k-text] font-medium">
                  {data.name}
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
                  <Clock className="h-3.5 w-3.5" />
                  Date de création
                </dt>
                <dd className="mt-1 text-sm text-[--k-muted]">
                  {formatDate(data.createdAt)}
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
              <div className="border-t border-[--k-border] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[--k-muted]">Montant estimé HT</span>
                  <span className="text-lg font-bold text-[--k-text]">
                    {formatPrice(estimatedTotal)}
                  </span>
                </div>
              </div>
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
            <p className="text-sm text-[--k-text] whitespace-pre-wrap">
              {data.comment}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Articles du modèle ({data.items?.length || 0})
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
                    src={getFullImageUrl(item.product?.imageUrl)}
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
                </div>
                <div className="flex items-center justify-between text-sm text-[--k-muted]">
                  <span>Qté : {item.quantity} | Prix : {formatPrice(item.unitPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-[--k-border]">
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
                    Quantité
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[--k-muted] uppercase">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--k-border]">
                {data.items?.map((item) => (
                  <tr key={item.id} className="row-hover transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getFullImageUrl(item.product?.imageUrl)}
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
                    <td className="px-4 py-3 text-sm text-right text-[--k-text] font-medium">
                      {item.unitPrice ? formatPrice(item.quantity * item.unitPrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Modifier le modèle"
        size="xl"
      >
        <OrderTemplateEditForm
          template={data}
          onSuccess={() => {
            setIsEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ['order-template', id] });
            queryClient.invalidateQueries({ queryKey: ['order-templates'] });
            toast.success('Modèle modifié', 'Le modèle a été mis à jour');
          }}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le modèle{' '}
            <span className="font-semibold text-[--k-text]">{data.name}</span> ?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
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
