import { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Package,
  ShoppingCart,
  MessageSquare,
  Save,
  X,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle,
  Hash,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import SupplierForm from '../components/forms/SupplierForm';
import SupplierContactForm from '../components/forms/SupplierContactForm';
import ReceiveOrderForm from '../components/forms/ReceiveOrderForm';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { Supplier, Order, ProductSupplier, SupplierContact, ApiResponse } from '../types';

interface SupplierWithRelations extends Supplier {
  productSuppliers: (ProductSupplier & {
    product: {
      id: string;
      reference: string;
      description?: string;
      imageUrl?: string;
      assemblyType?: { id: string; name: string };
    };
  })[];
  orders: Order[];
  contacts: SupplierContact[];
}

// Helper to get full image URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return DEFAULT_PRODUCT_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SupplierContact | undefined>();
  const [deleteContactConfirm, setDeleteContactConfirm] = useState<SupplierContact | null>(null);
  const [receiveItem, setReceiveItem] = useState<{ orderId: string; itemId: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SupplierWithRelations>>(`/suppliers/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const updateCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      await api.put(`/suppliers/${id}`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      setIsEditingComment(false);
      toast.success('Commentaire mis à jour', 'Le commentaire a été enregistré');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de mettre à jour le commentaire');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await api.delete(`/suppliers/${id}/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      setDeleteContactConfirm(null);
      toast.success('Contact supprimé', 'Le contact a été supprimé');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le contact');
    },
  });

  const handleAddContact = () => {
    setSelectedContact(undefined);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (contact: SupplierContact) => {
    setSelectedContact(contact);
    setIsContactModalOpen(true);
  };

  const handleContactModalClose = () => {
    setIsContactModalOpen(false);
    setSelectedContact(undefined);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'danger'> = {
      PENDING: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'danger',
    };
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      COMPLETED: 'Reçue',
      CANCELLED: 'Annulée',
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const getOrderLabel = (order: Order) => {
    if (order.title) return order.title;
    if (order.items?.length === 1) {
      const item = order.items[0];
      return item.product?.description || item.product?.reference || 'Commande';
    }
    return `${order.items?.length || 0} article${(order.items?.length || 0) > 1 ? 's' : ''}`;
  };

  const getOrderTotalQty = (order: Order) =>
    order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const getOrderReceivedQty = (order: Order) =>
    order.items?.reduce((sum, item) => sum + (item.receivedQty || 0), 0) || 0;

  const startEditComment = () => {
    setCommentValue(data?.comment || '');
    setIsEditingComment(true);
  };

  const cancelEditComment = () => {
    setIsEditingComment(false);
    setCommentValue('');
  };

  const saveComment = () => {
    updateCommentMutation.mutate(commentValue);
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
        <p className="text-red-600">Fournisseur non trouvé</p>
        <Button variant="secondary" onClick={() => navigate('/suppliers')} className="mt-4">
          Retour aux fournisseurs
        </Button>
      </div>
    );
  }

  const totalOrders = data.orders?.length || 0;
  const pendingOrders = data.orders?.filter((o) => o.status === 'PENDING').length || 0;
  const completedOrders = data.orders?.filter((o) => o.status === 'COMPLETED').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[--k-text]">{data.name}</h1>
            {data.contact && (
              <p className="text-[--k-muted]">Contact: {data.contact}</p>
            )}
          </div>
        </div>
        <Button onClick={() => setIsEditModalOpen(true)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Modifier
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informations principales */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {/* Infos à gauche */}
              <dl className="grid grid-cols-2 gap-4 flex-1 min-w-0">
                {data.name && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Nom</dt>
                    <dd className="mt-1 text-[--k-text]">{data.name}</dd>
                  </div>
                )}
                {data.contact && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Contact</dt>
                    <dd className="mt-1 text-[--k-text]">{data.contact}</dd>
                  </div>
                )}
                {data.email && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Email</dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${data.email}`}
                        className="flex items-center gap-1 text-[--k-primary] hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {data.email}
                      </a>
                    </dd>
                  </div>
                )}
                {data.phone && (
                  <div>
                    <dt className="text-[13px] font-medium text-[--k-muted]">Téléphone</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${data.phone}`}
                        className="flex items-center gap-1 text-[--k-primary] hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {data.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {data.website && (
                  <div className="min-w-0">
                    <dt className="text-[13px] font-medium text-[--k-muted]">Site web</dt>
                    <dd className="mt-1">
                      <a
                        href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[--k-primary] hover:underline min-w-0"
                      >
                        <Globe className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{data.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </dd>
                  </div>
                )}
                {(data.address || data.postalCode || data.city || data.country) && (
                  <div className="col-span-2">
                    <dt className="text-[13px] font-medium text-[--k-muted]">Adresse</dt>
                    <dd className="mt-1">
                      <div className="flex items-center gap-1 text-[--k-text]">
                        <MapPin className="h-4 w-4 text-[--k-muted] flex-shrink-0" />
                        <span>
                          {[data.address, data.postalCode, data.city, data.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </dd>
                  </div>
                )}
              </dl>

              {/* Map à droite */}
              {(data.latitude && data.longitude) ? (
                <div className="w-[280px] flex-shrink-0 overflow-hidden rounded-lg border border-[--k-border]">
                  <iframe
                    title="Localisation fournisseur"
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: '200px' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${data.latitude},${data.longitude}&zoom=15`}
                  />
                </div>
              ) : (data.address || data.city) ? (
                <div className="w-[280px] flex-shrink-0 overflow-hidden rounded-lg border border-[--k-border]">
                  <iframe
                    title="Localisation fournisseur"
                    width="100%"
                    height="100%"
                    style={{ border: 0, minHeight: '200px' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent([data.address, data.postalCode, data.city, data.country].filter(Boolean).join(', '))}`}
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Résumé commandes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-[--k-primary]">{totalOrders}</p>
                <p className="text-[13px] text-[--k-muted]">Total commandes</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[--k-border] pt-4">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-yellow-600">{pendingOrders}</p>
                  <p className="text-xs text-[--k-muted]">En attente</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-green-600">{completedOrders}</p>
                  <p className="text-xs text-[--k-muted]">Reçues</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes / Commentaires - affiche uniquement si commentaire present ou en mode edition */}
      {(data.comment || isEditingComment) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notes / Commentaires
            </CardTitle>
            {!isEditingComment && (
              <Button variant="ghost" size="sm" onClick={startEditComment}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingComment ? (
              <div className="space-y-3">
                <textarea
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  placeholder="Ajouter des notes ou commentaires sur ce fournisseur..."
                  rows={4}
                  className="input-field"
                  style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={cancelEditComment}>
                    <X className="mr-1 h-4 w-4" />
                    Annuler
                  </Button>
                  <Button size="sm" onClick={saveComment} disabled={updateCommentMutation.isPending}>
                    <Save className="mr-1 h-4 w-4" />
                    {updateCommentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[--k-text] whitespace-pre-wrap">{data.comment}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contacts ({data.contacts?.length || 0})
          </CardTitle>
          <Button size="sm" onClick={handleAddContact}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {!data.contacts?.length ? (
            <p className="text-[--k-muted]">Aucun contact enregistré pour ce fournisseur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2">Nom</th>
                    <th className="pb-2">Poste</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Téléphone</th>
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Modifié le</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-[--k-surface-2]">
                      <td className="py-3">
                        <span className="font-medium text-[--k-text]">
                          {contact.firstName} {contact.lastName}
                        </span>
                      </td>
                      <td className="py-3 text-[--k-muted]">
                        {contact.position || '-'}
                      </td>
                      <td className="py-3">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 text-[--k-muted] hover:text-[--k-primary]"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[180px]">{contact.email}</span>
                          </a>
                        ) : (
                          <span className="text-[--k-muted]">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1 text-[--k-muted] hover:text-[--k-primary]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-[--k-muted]">-</span>
                        )}
                      </td>
                      <td className="py-3 text-[--k-muted] max-w-[200px]">
                        {contact.description ? (
                          <span className="truncate block" title={contact.description}>
                            {contact.description}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 text-[13px] text-[--k-muted]">
                        {new Date(contact.updatedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditContact(contact)}
                            title="Modifier"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteContactConfirm(contact)}
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
        </CardContent>
      </Card>

      {/* Produits associés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produits associés ({data.productSuppliers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.productSuppliers?.length ? (
            <p className="text-[--k-muted]">Aucun produit associé à ce fournisseur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">Référence</th>
                    <th className="pb-2">Borne</th>
                    <th className="pb-2">Ref. fournisseur</th>
                    <th className="pb-2 text-right">Prix HT</th>
                    <th className="pb-2">Délai</th>
                    <th className="pb-2">Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.productSuppliers.map((ps) => (
                    <tr key={ps.id} className="hover:bg-[--k-surface-2]">
                      <td className="py-2">
                        <RouterLink
                          to={`/products/${ps.product.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <img
                            src={getFullImageUrl(ps.product.imageUrl)}
                            alt={ps.product.description || ps.product.reference}
                            className="h-[5rem] w-[5rem] rounded-lg object-cover bg-[--k-surface-2] flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                            }}
                          />
                          <span className="text-[16px] font-medium text-[--k-primary] group-hover:underline">
                            {ps.product.description || ps.product.reference}
                          </span>
                        </RouterLink>
                      </td>
                      <td className="py-2 text-[15px]">
                        <RouterLink
                          to={`/products/${ps.productId}`}
                          className="text-[--k-muted] hover:text-[--k-primary] hover:underline"
                        >
                          {ps.product.reference}
                        </RouterLink>
                      </td>
                      <td className="py-2 text-[--k-muted]">
                        {ps.product.assemblyType?.name || '-'}
                      </td>
                      <td className="py-2 text-[--k-muted]">{ps.supplierRef || '-'}</td>
                      <td className="py-2 text-right text-[--k-text]">
                        {ps.unitPrice ? (
                          <div className="flex flex-col items-end">
                            <span>{Number(ps.unitPrice).toFixed(2)} €</span>
                            {ps.priceUpdatedAt && (
                              <span className="text-[11px] text-[--k-muted]">
                                au {new Date(ps.priceUpdatedAt).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 text-[--k-muted]">{ps.leadTime || '-'}</td>
                      <td className="py-2">
                        {ps.isPrimary && <Badge variant="warning">Principal</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des commandes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique des commandes
          </CardTitle>
          <RouterLink to={`/orders?supplierId=${id}`}>
            <Button variant="ghost" size="sm">
              Voir tout
              <ExternalLink className="ml-1 h-4 w-4" />
            </Button>
          </RouterLink>
        </CardHeader>
        <CardContent>
          {!data.orders?.length ? (
            <p className="text-[--k-muted]">Aucune commande passée auprès de ce fournisseur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="pb-2 pr-4">N° Commande</th>
                    <th className="pb-2 pr-4">Date commande</th>
                    <th className="pb-2 pr-4">Commande</th>
                    <th className="pb-2 px-4 text-center">Articles</th>
                    <th className="pb-2 px-4 text-right">Quantité</th>
                    <th className="pb-2 pr-4">Statut</th>
                    <th className="pb-2 pr-4">Date prévue</th>
                    <th className="pb-2 pr-4">Date réception</th>
                    <th className="pb-2">Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.orders.map((order) => {
                    const totalQty = getOrderTotalQty(order);
                    const receivedQty = getOrderReceivedQty(order);

                    return (
                      <tr key={order.id} className="hover:bg-[--k-surface-2]">
                        <td className="py-2 pr-4">
                          <RouterLink
                            to={`/orders/${order.id}`}
                            className="flex items-center gap-1 font-mono text-xs font-medium text-[--k-primary] hover:underline"
                          >
                            <Hash className="h-3.5 w-3.5" />
                            {order.orderNumber || order.id.slice(0, 8)}
                          </RouterLink>
                        </td>
                        <td className="py-2 pr-4 text-[--k-muted]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(order.orderDate).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-medium text-[--k-text]">
                            {getOrderLabel(order)}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-center text-[--k-muted]">
                          {order.items?.length || 0}
                        </td>
                        <td className="py-2 px-4 text-right font-medium text-[--k-text]">
                          {totalQty}
                          {receivedQty > 0 && receivedQty !== totalQty && (
                            <span className="ml-1 text-xs text-[--k-muted]">
                              (reçu : {receivedQty})
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{getStatusBadge(order.status)}</td>
                        <td className="py-2 text-[--k-muted]">
                          {order.expectedDate ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(order.expectedDate).toLocaleDateString('fr-FR')}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 text-[--k-muted]">
                          {order.receivedDate ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              {new Date(order.receivedDate).toLocaleDateString('fr-FR')}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 text-[--k-muted]">
                          {order.destinationSite?.name || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modifier le fournisseur"
        size="lg"
      >
        <SupplierForm
          supplier={data}
          onSuccess={() => {
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['supplier', id] });
            toast.success('Fournisseur modifié', 'Les informations ont été mises à jour');
          }}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Contact Modal */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={handleContactModalClose}
        title={selectedContact ? 'Modifier le contact' : 'Ajouter un contact'}
      >
        <SupplierContactForm
          supplierId={id!}
          contact={selectedContact}
          onSuccess={() => {
            handleContactModalClose();
            toast.success(
              selectedContact ? 'Contact modifié' : 'Contact ajouté',
              selectedContact ? 'Les informations ont été mises à jour' : 'Le contact a été ajouté'
            );
          }}
          onCancel={handleContactModalClose}
        />
      </Modal>

      {/* Delete Contact Confirmation Modal */}
      <Modal
        isOpen={!!deleteContactConfirm}
        onClose={() => setDeleteContactConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le contact{' '}
            <span className="font-semibold text-[--k-text]">
              {deleteContactConfirm?.firstName} {deleteContactConfirm?.lastName}
            </span> ?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteContactConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteContactConfirm && deleteContactMutation.mutate(deleteContactConfirm.id)}
              disabled={deleteContactMutation.isPending}
            >
              {deleteContactMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receive Item Modal */}
      <Modal
        isOpen={!!receiveItem}
        onClose={() => setReceiveItem(null)}
        title="Réceptionner un article"
        size="md"
      >
        {receiveItem && (
          <ReceiveOrderForm
            orderId={receiveItem.orderId}
            itemId={receiveItem.itemId}
            onSuccess={() => {
              setReceiveItem(null);
              queryClient.invalidateQueries({ queryKey: ['supplier', id] });
              toast.success('Article réceptionné', 'La réception a été enregistrée avec succès');
            }}
            onCancel={() => setReceiveItem(null)}
          />
        )}
      </Modal>
    </div>
  );
}
