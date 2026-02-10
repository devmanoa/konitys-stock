import {
  Package, Home,
  type LucideIcon,
} from 'lucide-react'

export interface AppIdentity {
  icon: LucideIcon | null
  bg: string
  text: string
  accent: string
  activeBg: string
  activeText: string
  dot: string
  border: string
  topStripe: string
  sidebarHover: string
  sidebarActive: string
  sidebarActiveDot: string
}

const APP_IDENTITY: Record<string, AppIdentity> = {
  'Konitys Hub': {
    icon: Home,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    accent: 'blue',
    activeBg: 'bg-blue-500/[0.08]',
    activeText: 'text-blue-600',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
    topStripe: 'bg-blue-500',
    sidebarHover: 'hover:bg-blue-500/[0.10]',
    sidebarActive: 'bg-blue-500/[0.18]',
    sidebarActiveDot: 'bg-blue-400',
  },
  'Stock Manager': {
    icon: Package,
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    accent: 'emerald',
    activeBg: 'bg-emerald-500/[0.08]',
    activeText: 'text-emerald-600',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
    topStripe: 'bg-emerald-500',
    sidebarHover: 'hover:bg-emerald-500/[0.10]',
    sidebarActive: 'bg-emerald-500/[0.18]',
    sidebarActiveDot: 'bg-emerald-400',
  },
}

const DEFAULT_IDENTITY: AppIdentity = {
  icon: null,
  bg: 'bg-stone-50',
  text: 'text-stone-500',
  accent: 'stone',
  activeBg: 'bg-[--k-primary]/[0.08]',
  activeText: 'text-[--k-primary]',
  dot: 'bg-[--k-primary]',
  border: 'border-[--k-border]',
  topStripe: 'bg-[--k-primary]',
  sidebarHover: 'hover:bg-white/[0.06]',
  sidebarActive: 'bg-white/10',
  sidebarActiveDot: 'bg-white',
}

export function getAppIdentity(appName: string): AppIdentity {
  return APP_IDENTITY[appName] || DEFAULT_IDENTITY
}

export { APP_IDENTITY }
