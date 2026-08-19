import type { ReactNode } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react';
import Badge from '../components/ui/Badge';

/**
 * Badge de risque d'approvisionnement (HIGH/MEDIUM/LOW).
 * `fallback` permet de conserver le comportement de chaque page quand le
 * risque n'est pas défini : null (Products.tsx) ou <Badge>Non défini</Badge>
 * (ProductDetail.tsx).
 */
export const getRiskBadge = (risk?: string, fallback: ReactNode = null): ReactNode => {
  if (!risk) return fallback;
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

/**
 * Icône de type de mouvement (IN/OUT/TRANSFER).
 * `sizeClass` : 'h-5 w-5' dans Movements.tsx, 'h-4 w-4' dans ProductDetail.tsx.
 */
export const getMovementTypeIcon = (type: string, sizeClass = 'h-5 w-5') => {
  switch (type) {
    case 'IN':
      return <ArrowDownCircle className={`${sizeClass} text-green-500`} />;
    case 'OUT':
      return <ArrowUpCircle className={`${sizeClass} text-red-500`} />;
    case 'TRANSFER':
      return <ArrowLeftRight className={`${sizeClass} text-blue-500`} />;
    default:
      return null;
  }
};
