import React, { Component, Suspense, useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Truck,
  Warehouse,
  Layers,
  ArrowLeftRight,
  ShoppingCart,
  FileText,
  Boxes,
  Upload,
  Settings,
  Factory,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { loadRemoteComponent } from '../../remoteLoader'
import { Topbar } from '../Topbar'
import { Sidebar } from '../Sidebar'

// Lazy-load remote components
const RemoteHeaderBar = React.lazy(() => loadRemoteComponent('./HeaderBar'))
const RemoteSidebar = React.lazy(() => loadRemoteComponent('./Sidebar'))

// Sidebar sections for this app
const SIDEBAR_SECTIONS = [
  {
    label: 'Stocks',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
      { icon: Layers, label: 'Stocks', path: '/stocks' },
      { icon: ArrowLeftRight, label: 'Mouvements', path: '/movements' },
    ],
  },
  {
    label: 'Commandes',
    items: [
      { icon: ShoppingCart, label: 'Commandes', path: '/orders' },
      { icon: FileText, label: 'Modèles', path: '/order-templates' },
      { icon: Boxes, label: 'Packs de commande', path: '/packs' },
    ],
  },
  {
    label: 'Bornes',
    items: [
      { icon: Factory, label: 'Bornes constructibles', path: '/buildable-bornes' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { icon: Package, label: 'Produits', path: '/products' },
      { icon: Truck, label: 'Fournisseurs', path: '/suppliers' },
      { icon: Warehouse, label: 'Sites', path: '/sites' },
      { icon: Settings, label: 'Paramètres', path: '/settings' },
      { icon: Upload, label: 'Import / Export', path: '/import-export' },
    ],
  },
]

// Placeholder matching header height
function HeaderFallback() {
  return <div className="h-12 shrink-0 border-b border-[--k-border] bg-gradient-to-r from-white to-blue-50" />
}

// Placeholder matching sidebar width
function SidebarFallback() {
  return <div className="w-[210px] shrink-0 bg-[--k-sidebar-bg] h-full" />
}

// Error boundary that catches remote loading failures and renders a local fallback
interface RemoteErrorBoundaryProps {
  fallback: React.ReactNode
  children: React.ReactNode
}

interface RemoteErrorBoundaryState {
  hasError: boolean
}

class RemoteErrorBoundary extends Component<RemoteErrorBoundaryProps, RemoteErrorBoundaryState> {
  constructor(props: RemoteErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): RemoteErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
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

  // Local fallback components
  const localTopbar = (
    <Topbar onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)} />
  )

  const localSidebar = (
    <Sidebar
      collapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed((v) => !v)}
    />
  )

  const localMobileSidebar = (
    <Sidebar
      collapsed={false}
      onToggle={() => setMobileMenuOpen(false)}
    />
  )

  return (
    <div className="h-screen flex flex-col bg-[--k-bg]">
      {/* Header — remote with local fallback */}
      <RemoteErrorBoundary fallback={localTopbar}>
        <Suspense fallback={<HeaderFallback />}>
          <RemoteHeaderBar
            user={headerUser}
            onLogout={logout}
            currentAppName="Stock Manager"
            onNavigate={handleNavigate}
          />
        </Suspense>
      </RemoteErrorBoundary>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — remote with local fallback */}
        <div className="hidden md:block">
          <RemoteErrorBoundary fallback={localSidebar}>
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
          </RemoteErrorBoundary>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-12 z-40 h-[calc(100vh-48px)] md:hidden">
              <RemoteErrorBoundary fallback={localMobileSidebar}>
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
              </RemoteErrorBoundary>
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
