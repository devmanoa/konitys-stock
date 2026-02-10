// Enums
export type SupplyRisk = 'HIGH' | 'MEDIUM' | 'LOW';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER';
export type ProductCondition = 'NEW' | 'USED';
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type SiteType = 'STORAGE' | 'EXIT';
export type PackType = 'IN' | 'OUT';

// Base interfaces
export interface AssemblyType {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
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
  createdAt: string;
  contacts?: SupplierContact[];
  _count?: {
    productSuppliers: number;
    orders: number;
  };
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

export interface Product {
  id: string;
  reference: string;
  description?: string;
  qtyPerUnit: number;
  supplyRisk?: SupplyRisk;
  location?: string;
  assemblyId?: string;
  assembly?: Assembly;
  assemblyTypeId?: string;
  assemblyType?: AssemblyType;
  comment?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  productSuppliers?: ProductSupplier[];
  stocks?: Stock[];
  movements?: StockMovement[];
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
  createdBy?: string;
  items: OrderItem[];
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

export interface LowStockAlert {
  id: string;
  reference: string;
  description?: string;
  assembly?: string;
  qtyPerUnit: number;
  supplyRisk?: SupplyRisk;
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
  reference: string;
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
  qtyPerUnit?: number;
  supplyRisk?: SupplyRisk;
  location?: string;
  assemblyId?: string;
  assemblyTypeId?: string;
  comment?: string;
  imageUrl?: string;
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
  };
  quantity: number;
}

export interface Pack {
  id: string;
  name: string;
  type: PackType;
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
  type: PackType;
  description?: string;
  items: { productId: string; quantity: number }[];
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
