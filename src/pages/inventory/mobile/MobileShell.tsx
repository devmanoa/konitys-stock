import type { ReactNode } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { ListChecks, Clock } from 'lucide-react'

/**
 * Fullscreen, no-sidebar layout used by every /m/:linkId page.
 *
 * Bottom-bar gives 2 destinations: "Saisie" (the welcome screen) and "Mes
 * récents". We hide the bar on screens with `noBar` so the modal-like flows
 * (zone, scanner) get the full viewport.
 */
export default function MobileShell({
  children,
  title,
  subtitle,
  noBar = false,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  noBar?: boolean
}) {
  const { linkId } = useParams<{ linkId: string }>()
  const location = useLocation()
  const isRecent = location.pathname.endsWith('/recent')

  return (
    <div className="min-h-screen bg-[--k-bg] text-[--k-text] flex flex-col">
      {(title || subtitle) && (
        <header className="bg-[--k-surface] border-b border-[--k-border] px-4 py-3 sticky top-0 z-10">
          {title && <h1 className="text-[16px] font-semibold leading-tight">{title}</h1>}
          {subtitle && <p className="text-[12px] text-[--k-muted] mt-0.5">{subtitle}</p>}
        </header>
      )}

      <main className={`flex-1 ${noBar ? '' : 'pb-20'} px-4 py-4`}>{children}</main>

      {!noBar && linkId && (
        <nav className="fixed bottom-0 inset-x-0 z-20 bg-[--k-surface] border-t border-[--k-border] flex">
          <Link
            to={`/m/${linkId}`}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-medium ${
              !isRecent ? 'text-[--k-primary]' : 'text-[--k-muted]'
            }`}
          >
            <ListChecks className="h-5 w-5 mb-0.5" />
            Saisie
          </Link>
          <Link
            to={`/m/${linkId}/recent`}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-medium ${
              isRecent ? 'text-[--k-primary]' : 'text-[--k-muted]'
            }`}
          >
            <Clock className="h-5 w-5 mb-0.5" />
            Mes saisies
          </Link>
        </nav>
      )}
    </div>
  )
}

export function MobileError({ title, message }: { title: string; message: string }) {
  return (
    <MobileShell noBar>
      <div className="flex flex-col items-center text-center pt-16">
        <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-2xl">
          !
        </div>
        <h2 className="mt-4 text-[17px] font-semibold">{title}</h2>
        <p className="mt-2 text-[13px] text-[--k-muted] max-w-xs">{message}</p>
      </div>
    </MobileShell>
  )
}
