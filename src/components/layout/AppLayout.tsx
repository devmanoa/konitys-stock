import React, { Suspense, useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Truck,
  Warehouse,
  Layers,
  ArrowLeftRight,
  ShoppingCart,
  Boxes,
  Upload,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { loadRemoteComponent } from '../../remoteLoader'

// Lazy-load remote components
const RemoteHeaderBar = React.lazy(() => loadRemoteComponent('./HeaderBar'))
const RemoteSidebar = React.lazy(() => loadRemoteComponent('./Sidebar'))

// Sidebar sections for this app
const SIDEBAR_SECTIONS = [
  {
    label: 'Catalogue',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
      { icon: Package, label: 'Produits', path: '/products' },
      { icon: Truck, label: 'Fournisseurs', path: '/suppliers' },
      { icon: Warehouse, label: 'Sites', path: '/sites' },
    ],
  },
  {
    label: 'Inventaire',
    items: [
      { icon: Layers, label: 'Stocks', path: '/stocks' },
      { icon: ArrowLeftRight, label: 'Mouvements', path: '/movements' },
    ],
  },
  {
    label: 'Commandes',
    items: [
      { icon: ShoppingCart, label: 'Commandes', path: '/orders' },
      { icon: Boxes, label: 'Packs', path: '/packs' },
      { icon: Upload, label: 'Import / Export', path: '/import-export' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { icon: Settings, label: 'Paramètres', path: '/settings' },
    ],
  },
]

// Placeholder matching header height
function HeaderFallback() {
  return <div className="h-12 shrink-0 border-b border-[--k-border] bg-gradient-to-r from-white to-blue-50" />
}

// Placeholder matching sidebar width
function SidebarFallback() {
  return <div className="hidden md:block w-[210px] shrink-0 bg-[--k-sidebar-bg]" />
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('k_sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('k_sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Map auth user to remote header user shape
  const headerUser = user
    ? {
        firstName: user.firstName || user.fullName?.split(' ')[0] || '',
        lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        username: user.username || '',
      }
    : null

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <div className="h-screen flex flex-col bg-[--k-bg]">
      {/* Remote Header — full width */}
      <Suspense fallback={<HeaderFallback />}>
        <RemoteHeaderBar
          user={headerUser}
          onLogout={logout}
          currentAppName="Stock Manager"
          onNavigate={handleNavigate}
        />
      </Suspense>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Suspense fallback={<SidebarFallback />}>
            <RemoteSidebar
              sections={SIDEBAR_SECTIONS}
              activePath={location.pathname}
              onNavigate={handleNavigate}
              collapsed={sidebarCollapsed}
              onCollapse={() => setSidebarCollapsed((v) => !v)}
              onHelpClick={() => {}}
            />
          </Suspense>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-12 z-40 h-[calc(100vh-48px)] md:hidden">
              <Suspense fallback={<SidebarFallback />}>
                <RemoteSidebar
                  sections={SIDEBAR_SECTIONS}
                  activePath={location.pathname}
                  onNavigate={handleNavigate}
                  collapsed={false}
                  onCollapse={() => setMobileMenuOpen(false)}
                  onHelpClick={() => {}}
                />
              </Suspense>
            </div>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3 md:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
