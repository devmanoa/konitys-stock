// Enums
export type SupplyRisk = 'HIGH' | 'MEDIUM' | 'LOW';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER';
export type ProductCondition = 'NEW' | 'USED';
export type OrderStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
/**
 * Type/nature d'une pièce. Orthogonal à PartCategory qui décrit la
 * localisation physique (Tête / Pied / Socle). Utilisé côté Factory
 * pour grouper la checklist d'assemblage.
 */
export type PartType = 'EQUIPMENT' | 'PROTECTION' | 'HARDWARE';

export const PART_TYPE_LABEL: Record<PartType, string> = {
  EQUIPMENT: 'Équipement',
  PROTECTION: 'Protection',
  HARDWARE: 'Visserie',
};

export type AnomalyDecision = 'ACCEPTED' | 'REFUSED';

export interface OrderItemAnomaly {
  id: string;
  orderItemId: string;
  quantity: number;
  decision: AnomalyDecision;
  comment: string;
  photoUrls: string[];
  reportedAt: string;
  reportedById?: string | null;
  reportedByName?: string | null;
}

export interface ReceptionAnomalyWithContext extends OrderItemAnomaly {
  orderItem: {
    id: string;
    order: { id: string; orderNumber: string; orderDate: string };
    product: { id: string; reference: string; description?: string; imageUrl?: string };
  };
}
export type SiteType = 'STORAGE' | 'EXIT';

// Base interfaces
export interface PartCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count?: {
    products: number;
  };
}

/**
 * Catégorie principale d'un produit (Imprimante, PC, Écran, Câble, …).
 * Le `codeReference` sert de préfixe pour générer les références internes
 * (Lot 2). Distincte de PartCategory (localisation) et PartType (nature).
 */
export interface ProductCategory {
  id: string;
  name: string;
  codeReference: string;
  description?: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPartCategory {
  id: string;
  productId: string;
  partCategoryId: string;
  partCategory: PartCategory;
}

export interface AssemblyTypeItem {
  id: string;
  assemblyTypeId: string;
  productId: string;
  product: {
    id: string;
    reference: string;
    description?: string;
    imageUrl?: string;
    partType?: PartType | null;
  };
  quantity: number;
  partCategoryId?: string | null;
  partCategory?: { id: string; name: string } | null;
}

export interface AssemblyType {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  items?: AssemblyTypeItem[];
  _count?: {
    assemblies: number;
  };
}

export interface Assembly {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  assemblyTypes?: AssemblyType[];
  _count?: {
    products: number;
  };
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  comment?: string;
  // Company data fetched from api.gouv.fr
  siret?: string | null;
  siren?: string | null;
  legalName?: string | null;
  legalStatus?: string | null;
  naf?: string | null;
  nafLabel?: string | null;
  creationYear?: number | null;
  companyInfoUpdatedAt?: string | null;
  createdAt: string;
  contacts?: SupplierContact[];
  _count?: {
    productSuppliers: number;
    orders: number;
  };
}

export interface CompanyLookupResult {
  siret: string | null;
  siren: string | null;
  legalName: string | null;
  legalStatus: string | null;
  naf: string | null;
  nafLabel: string | null;
  creationYear: number | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
}

export interface Location {
  id: string;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  parentId?: string | null;
  parent?: Location | null;
  children?: Location[];
  name: string;
  position: number;
  createdAt: string;
}

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  address?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    stocks: number;
  };
}

export interface ProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  supplier: Supplier;
  supplierRef?: string;
  unitPrice?: number;
  leadTime?: string;
  productUrl?: string;
  shippingCost?: number;
  isPrimary: boolean;
  priceUpdatedAt?: string;
}

export interface Stock {
  id: string;
  productId: string;
  siteId: string;
  site: Site;
  quantityNew: number;
  quantityUsed: number;
  updatedAt: string;
}

export interface ProductAssemblyTypeLink {
  assemblyTypeId: string;
  assemblyType: { id: string; name: string };
  qtyPerUnit: number;
}

export interface Product {
  id: string;
  reference: string;
  description?: string;
  supplyRisk?: SupplyRisk;
  partType?: PartType | null;
  minStock?: number | null;
  location?: string;
  locationId?: string | null;
  /** Resolved storage location (with parent + site for label rendering). */
  storageLocation?: Location | null;
  assemblyId?: string;
  assembly?: Assembly;
  /** Many-to-many: a product may belong to several assembly types, each with its own qtyPerUnit. */
  assemblyTypes?: ProductAssemblyTypeLink[];
  comment?: string;
  imageUrl?: string;
  externalLinks?: { id: string; url: string; position: number }[];
  hasSerialNumber?: boolean;
  createdAt: string;
  updatedAt: string;
  productSuppliers?: ProductSupplier[];
  stocks?: Stock[];
  movements?: StockMovement[];
  partCategories?: ProductPartCategory[];
}

export interface ProductAuditEntry {
  id: string;
  productId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: string;
  changedById?: string | null;
  changedByName?: string | null;
}

export type SerialStatus = 'IN_STOCK' | 'OUT' | 'IN_REPAIR' | 'SCRAPPED' | 'LOST';

export interface ProductSerialItem {
  id: string;
  productId: string;
  serialNumber?: string | null;
  condition: ProductCondition;
  siteId?: string | null;
  site?: { id: string; name: string } | null;
  status: SerialStatus;
  enteredAt: string;
  exitedAt?: string | null;
  borneNumber?: string | null;
  comment?: string | null;
  createdAt: string;
  createdById?: string | null;
  createdByName?: string | null;
  updatedAt: string;
  product?: { id: string; reference: string; description?: string };
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Product;
  type: MovementType;
  sourceSiteId?: string;
  sourceSite?: Site;
  targetSiteId?: string;
  targetSite?: Site;
  quantity: number;
  condition: ProductCondition;
  movementDate: string;
  operator?: string;
  comment?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice?: number;
  receivedQty?: number;
  receivedDate?: string;
  condition?: string;
  anomalies?: OrderItemAnomaly[];
}

export interface OrderAuditEntry {
  id: string;
  orderId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt: string;
  changedById?: string | null;
  changedByName?: string | null;
}

export interface OrderAttachment {
  id: string;
  orderId: string;
  filename: string;
  url: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt: string;
  uploadedById?: string | null;
  uploadedByName?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  title?: string;
  supplierId: string;
  supplier: Supplier;
  status: OrderStatus;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  destinationSiteId?: string;
  destinationSite?: Site;
  responsible?: string;
  supplierRef?: string;
  comment?: string;
  shippingCost?: number | string | null;
  createdBy?: string;
  items: OrderItem[];
  attachments?: OrderAttachment[];
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Dashboard types
export interface DashboardStats {
  totalProducts: number;
  totalSuppliers: number;
  totalSites: number;
  pendingOrders: number;
  completedOrdersThisMonth: number;
  totalItems: number;
  totalStockNew: number;
  totalStockUsed: number;
  totalStockValue: number;
  highRiskProducts: number;
  totalPossibleUnits: number;
}

export interface ProductPriceHistoryEntry {
  id: string;
  productId: string;
  supplierId: string;
  supplierName: string;
  unitPrice: string | number;
  changedAt: string;
  changedById?: string | null;
  changedByName?: string | null;
}

export interface LowStockAlert {
  id: string;
  reference: string;
  description?: string;
  imageUrl?: string;
  assembly?: string;
  assemblyType?: { id: string; name: string } | null;
  qtyPerUnit: number;
  supplyRisk?: SupplyRisk;
  minStock?: number | null;
  totalNew: number;
  totalUsed: number;
  total: number;
  possibleUnits: number;
  primarySupplier?: string;
  leadTime?: string;
}

export interface MovementsByDay {
  date: string;
  IN: number;
  OUT: number;
  TRANSFER: number;
}

export interface StockBySite {
  name: string;
  totalNew: number;
  totalUsed: number;
  productCount: number;
}

export interface TopProductStock {
  id?: string;
  reference: string;
  description?: string;
  imageUrl?: string;
  assembly: string;
  totalNew: number;
  totalUsed: number;
  total: number;
}

export interface OrdersByMonth {
  month: string;
  pending: number;
  completed: number;
  cancelled: number;
  totalQty: number;
}

// Form types
export interface CreateProductInput {
  reference: string;
  description?: string;
  supplyRisk?: SupplyRisk;
  partType?: PartType | null;
  minStock?: number | null;
  location?: string;
  locationId?: string | null;
  assemblyId?: string;
  assemblyTypes?: { assemblyTypeId: string; qtyPerUnit: number }[];
  comment?: string;
  imageUrl?: string;
  externalLinks?: string[];
  partCategoryIds?: string[];
  hasSerialNumber?: boolean;
}

export interface CreateMovementInput {
  productId: string;
  type: MovementType;
  sourceSiteId?: string;
  targetSiteId?: string;
  quantity: number;
  condition: ProductCondition;
  movementDate: string;
  operator?: string;
  comment?: string;
}

export interface CreateOrderInput {
  supplierId: string;
  title?: string;
  orderDate: string;
  expectedDate?: string;
  destinationSiteId?: string;
  responsible?: string;
  supplierRef?: string;
  comment?: string;
  shippingCost?: number | null;
  createdBy?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
}

export interface ReceiveItemInput {
  receivedDate: string;
  receivedQty: number;
  condition?: ProductCondition;
  comment?: string;
}

// Pack types
export interface PackItem {
  id: string;
  packId: string;
  productId: string;
  product: {
    id: string;
    reference: string;
    description?: string;
    imageUrl?: string;
  };
  quantity: number;
}

export interface ProductComment {
  id: string;
  productId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnownUser {
  authorId: string;
  authorUsername: string;
  authorName: string;
}

export interface Pack {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  items: PackItem[];
  _count?: {
    items: number;
  };
}

export interface CreatePackInput {
  name: string;
  description?: string;
  items: { productId: string; quantity: number }[];
}

// Buildable bornes (live computation per AssemblyType)
export interface BuildableComponent {
  id: string;
  productId: string;
  product: {
    id: string;
    reference: string;
    description?: string;
    imageUrl?: string;
  };
  required: number;
  currentStock: number;
  section?: string | null;
}

export interface BuildableBorne {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  maxBuildable: number;
  components: BuildableComponent[];
}

// Order Templates
export interface OrderTemplateItem {
  id: string;
  templateId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice?: number;
}

export interface OrderTemplate {
  id: string;
  name: string;
  supplierId: string;
  supplier: Supplier;
  destinationSiteId?: string;
  destinationSite?: Site;
  responsible?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderTemplateItem[];
  _count?: {
    items: number;
  };
}

export interface CreateOrderTemplateInput {
  name: string;
  supplierId: string;
  destinationSiteId?: string;
  responsible?: string;
  comment?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
}
