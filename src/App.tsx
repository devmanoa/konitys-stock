import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Stocks from './pages/Stocks'
import Movements from './pages/Movements'
import Sites from './pages/Sites'
import Packs from './pages/Packs'
import ImportExport from './pages/ImportExport'
import Settings from './pages/Settings'
import OrderTemplates from './pages/OrderTemplates'
import OrderTemplateDetail from './pages/OrderTemplateDetail'
import BuildableBornes from './pages/BuildableBornes'
import AssemblyTypeEdit from './pages/AssemblyTypeEdit'
import StockAlerts from './pages/StockAlerts'
import Scan from './pages/Scan'
import InventoryList from './pages/inventory/InventoryList'
import InventoryDetail from './pages/inventory/InventoryDetail'
import InventoryZone from './pages/inventory/InventoryZone'
import InventoryCompare from './pages/inventory/InventoryCompare'
import MobileInventory from './pages/inventory/mobile/MobileInventory'
import MobileInventoryZone from './pages/inventory/mobile/MobileInventoryZone'
import MobileInventoryRecent from './pages/inventory/mobile/MobileInventoryRecent'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Mobile share-link routes — NO Keycloak. The linkId in the URL
                is the credential. Anything below /m/:linkId calls
                /api/public/inventory/:linkId/* directly. */}
            <Route path="/m/:linkId" element={<MobileInventory />} />
            <Route path="/m/:linkId/zone/:locationId" element={<MobileInventoryZone />} />
            <Route path="/m/:linkId/recent" element={<MobileInventoryRecent />} />

            {/* Everything else is authenticated via Keycloak. */}
            <Route
              path="/*"
              element={
                <AuthProvider>
                  <AuthenticatedRoutes />
                </AuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <Scan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="stocks" element={<Stocks />} />
        <Route path="stocks/alerts" element={<StockAlerts />} />
        <Route path="movements" element={<Movements />} />
        <Route path="inventory" element={<InventoryList />} />
        <Route path="inventory/:id" element={<InventoryDetail />} />
        <Route path="inventory/:id/compare" element={<InventoryCompare />} />
        <Route path="inventory/:id/zone/:locationId" element={<InventoryZone />} />
        <Route path="sites" element={<Sites />} />
        <Route path="packs" element={<Packs />} />
        <Route path="buildable-bornes" element={<BuildableBornes />} />
        <Route path="import-export" element={<ImportExport />} />
        <Route path="order-templates" element={<OrderTemplates />} />
        <Route path="order-templates/:id" element={<OrderTemplateDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/assembly-types/new" element={<AssemblyTypeEdit />} />
        <Route path="settings/assembly-types/:id/edit" element={<AssemblyTypeEdit />} />
      </Route>
    </Routes>
  )
}

export default App
