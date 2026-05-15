import type { Product } from '../types'

export type AssemblyTypeRef = { id: string; name: string }

/** Returns the first assembly type linked to the product, or null. */
export function getPrimaryAssemblyType(product: Pick<Product, 'assemblyTypes'>): AssemblyTypeRef | null {
  const link = product.assemblyTypes?.[0]
  return link ? link.assemblyType : null
}

/** Returns every assembly type linked to the product. */
export function getAssemblyTypes(product: Pick<Product, 'assemblyTypes'>): AssemblyTypeRef[] {
  return (product.assemblyTypes || []).map((l) => l.assemblyType)
}

/** Returns the min qtyPerUnit across all linked types (worst-case for capacity calcs). */
export function getMinQtyPerUnit(product: Pick<Product, 'assemblyTypes'>): number {
  const qtys = (product.assemblyTypes || []).map((l) => l.qtyPerUnit).filter((q) => q > 0)
  if (qtys.length === 0) return 0
  return Math.min(...qtys)
}

/** Returns true if any of the product's assembly types matches the given id. */
export function hasAssemblyType(product: Pick<Product, 'assemblyTypes'>, assemblyTypeId: string): boolean {
  return (product.assemblyTypes || []).some((l) => l.assemblyTypeId === assemblyTypeId)
}
