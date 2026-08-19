import type { PartType } from '../../types';

/** Palette des badges "type de pièce" partagée par les sections Paramètres. */
export const PART_TYPE_BADGE_CLASS: Record<PartType, string> = {
  EQUIPMENT: 'bg-blue-50 text-blue-700',
  PROTECTION: 'bg-emerald-50 text-emerald-700',
  ACCESSORY: 'bg-amber-50 text-amber-800',
};
