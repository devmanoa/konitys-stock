import { Clock, CheckCircle, XCircle } from 'lucide-react';
import Badge from '../components/ui/Badge';
import type { Order } from '../types';

/**
 * Helpers d'affichage des commandes, partagés entre Orders.tsx, OrderDetail.tsx
 * et SupplierDetail.tsx.
 *
 * NB : SupplierDetail garde son propre badge de statut (libellés différents :
 * « En attente » / « Reçue ») — seul le comportement commun est unifié ici.
 */

/** Icône de statut de commande (Orders.tsx). */
export const getStatusIcon = (status: string) => {
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

/** Badge de statut de commande (Orders.tsx / OrderDetail.tsx). */
export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">En cours</Badge>;
    case 'PARTIAL':
      return <Badge variant="info">Reçu partiellement</Badge>;
    case 'COMPLETED':
      return <Badge variant="success">Terminée</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger">Annulée</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

/** Titre/description d'une commande pour l'affichage. */
export const getOrderLabel = (order: Order) => {
  if (order.title) return order.title;
  if (order.items?.length === 1) {
    const item = order.items[0];
    return item.product?.description || item.product?.reference || 'Commande';
  }
  return `${order.items?.length || 0} article${(order.items?.length || 0) > 1 ? 's' : ''}`;
};

/** Quantité totale commandée (somme des lignes). */
export const getOrderTotalQty = (order: Order) =>
  order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

/** Quantité totale reçue (somme des lignes). */
export const getOrderReceivedQty = (order: Order) =>
  order.items?.reduce((sum, item) => sum + (item.receivedQty || 0), 0) || 0;
