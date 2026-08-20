import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Spinner from './components/ui/Spinner'
import DebugConsole from './components/DebugConsole'
// Dashboard reste en import statique : c'est la landing page la plus fréquente,
// la garder dans le chunk principal évite un aller-retour réseau au premier rendu.
import Dashboard from './pages/Dashboard'

// Toutes les autres pages sont chargées à la demande (code-splitting par route).
const Products = lazy(() => import('./pages/Products'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Stocks = lazy(() => import('./pages/Stocks'))
const Movements = lazy(() => import('./pages/Movements'))
const Sites = lazy(() => import('./pages/Sites'))
const Packs = lazy(() => import('./pages/Packs'))
const ImportExport = lazy(() => import('./pages/ImportExport'))
const Settings = lazy(() => import('./pages/Settings'))
const OrderTemplates = lazy(() => import('./pages/OrderTemplates'))
const OrderTemplateDetail = lazy(() => import('./pages/OrderTemplateDetail'))
const BuildableBornes = lazy(() => import('./pages/BuildableBornes'))
const AssemblyTypeEdit = lazy(() => import('./pages/AssemblyTypeEdit'))
const StockAlerts = lazy(() => import('./pages/StockAlerts'))
const Scan = lazy(() => import('./pages/Scan'))
const InventoryList = lazy(() => import('./pages/inventory/InventoryList'))
const InventoryDetail = lazy(() => import('./pages/inventory/InventoryDetail'))
const InventoryZone = lazy(() => import('./pages/inventory/InventoryZone'))
const InventoryCompare = lazy(() => import('./pages/inventory/InventoryCompare'))
const MobileInventory = lazy(() => import('./pages/inventory/mobile/MobileInventory'))
const MobileInventoryZone = lazy(() => import('./pages/inventory/mobile/MobileInventoryZone'))
const MobileInventoryRecent = lazy(() => import('./pages/inventory/mobile/MobileInventoryRecent'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

/** Fallback plein écran pendant le chargement d'un chunk de page. */
function FullScreenLoader() {
  return <Spinner size="lg" className="min-h-screen" />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          {/* Floating debug console — opt-in via ?debug=1 or localStorage.debug=1.
              Mounted outside <Routes> so it's available on every page including
              the public mobile share-link routes. */}
          <DebugConsole />
          <Suspense fallback={<FullScreenLoader />}>
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
          </Suspense>
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
