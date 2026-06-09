import type { Site } from '../../types'

export type ItemState = 'OK' | 'TO_CHECK' | 'DAMAGED' | 'OUT_OF_SERVICE'

export type InventoryStatus = 'DRAFT' | 'CLOSED'

export interface Inventory {
  id: string
  name: string
  siteId: string | null
  site?: Site | null
  status: InventoryStatus
  startedAt: string
  closedAt: string | null
  closedByName: string | null
  correctionsApplied: boolean
  correctionsAppliedAt: string | null
  _count?: { entries: number; unknowns: number }
}

export interface InventoryEntry {
  id: string
  productId: string
  quantity: number
  serialNumber: string | null
  state: ItemState
  comment: string | null
  photoUrl: string | null
  source: 'SCAN' | 'SEARCH' | 'CATEGORY' | 'UNKNOWN'
  operatorName: string | null
  createdAt: string
  product: {
    id: string
    reference: string
    description: string | null
    imageUrl: string | null
    hasSerialNumber: boolean
  }
  location?: { id: string; name: string } | null
}

export const STATE_LABEL: Record<ItemState, string> = {
  OK: 'OK',
  TO_CHECK: 'À contrôler',
  DAMAGED: 'Abîmé',
  OUT_OF_SERVICE: 'Hors service',
}

export const STATE_BADGE: Record<ItemState, string> = {
  OK: 'bg-emerald-100 text-emerald-700',
  TO_CHECK: 'bg-amber-100 text-amber-700',
  DAMAGED: 'bg-rose-100 text-rose-700',
  OUT_OF_SERVICE: 'bg-slate-200 text-slate-700',
}
