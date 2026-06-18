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
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { loadRemoteComponent } from '../../remoteLoader'
import { Topbar } from '../Topbar'
import ErrorBoundary from '../ErrorBoundary'
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
      { icon: ClipboardList, label: 'Inventaire', path: '/inventory' },
    ],
  },
  {
    label: 'Commandes',
    items: [
      { icon: ShoppingCart, label: 'Commandes', path: '/orders' },
      { icon: FileText, label: 'Modèles', path: '/order-templates' },
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
      { icon: Boxes, label: 'Packs de pièces', path: '/packs' },
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

// Routes that should render in fullscreen mobile mode: no topbar, no main
// padding. The page becomes the whole viewport on small screens but stays
// normal on desktop. Keep this list small — it exists to support pages that
// were designed as a "task-focused mobile screen" (movements, soon others).
const MOBILE_FULLSCREEN_ROUTES = ['/movements']

function isFullscreenMobileRoute(pathname: string): boolean {
  return MOBILE_FULLSCREEN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fullscreenMobile = isFullscreenMobileRoute(location.pathname)

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
      {/* Header — remote with local fallback.
          Hidden on mobile for fullscreen routes (e.g. /movements). The page
          is task-focused on a phone; we don't want app chrome eating viewport. */}
      <div className={fullscreenMobile ? 'hidden md:block' : ''}>
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
      </div>

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

        {/* Main content. Fullscreen mobile routes get zero padding on small
            screens so the page can use the full viewport; desktop keeps the
            standard padding. */}
        <main
          className={`flex-1 min-w-0 overflow-y-auto md:p-5 ${fullscreenMobile ? 'p-0' : 'p-3'}`}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
