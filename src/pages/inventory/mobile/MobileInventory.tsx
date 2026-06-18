import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2, MapPin } from 'lucide-react'
import publicApi from '../../../services/publicApi'
import MobileShell, { MobileError } from './MobileShell'

interface ResolveData {
  inventoryId: string
  inventoryName: string
  inventoryStatus: 'DRAFT' | 'CLOSED'
  site: { id: string; name: string } | null
  operatorName: string
  expiresAt: string | null
}

interface LocationRow {
  id: string
  name: string
  parentId: string | null
  siteId: string | null
}

export default function MobileInventory() {
  const { linkId } = useParams<{ linkId: string }>()
  const navigate = useNavigate()
  const [parentId, setParentId] = useState<string | null>(null)

  const resolveQ = useQuery({
    queryKey: ['m-resolve', linkId],
    queryFn: async () => {
      const res = await publicApi.get<{ success: boolean; data: ResolveData }>(`inventory/${linkId}`)
      return res.data.data
    },
    retry: false,
  })

  const locationsQ = useQuery({
    queryKey: ['m-locations', linkId],
    queryFn: async () => {
      const res = await publicApi.get<{ success: boolean; data: LocationRow[] }>(
        `inventory/${linkId}/locations`,
      )
      return res.data.data
    },
    enabled: resolveQ.isSuccess,
  })

  const visible = useMemo(() => {
    const all = locationsQ.data || []
    return all.filter((l) => (l.parentId || null) === parentId)
  }, [locationsQ.data, parentId])

  const breadcrumb = useMemo(() => {
    const all = locationsQ.data || []
    if (!parentId) return [] as LocationRow[]
    const trail: LocationRow[] = []
    let cursor = all.find((l) => l.id === parentId)
    while (cursor) {
      trail.unshift(cursor)
      cursor = all.find((l) => l.id === cursor!.parentId)
    }
    return trail
  }, [locationsQ.data, parentId])

  if (resolveQ.isLoading) {
    return (
      <MobileShell noBar>
        <div className="pt-16 flex flex-col items-center text-[--k-muted]">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="mt-2 text-[13px]">Chargement…</p>
        </div>
      </MobileShell>
    )
  }

  if (resolveQ.isError) {
    const status = (resolveQ.error as any)?.response?.status
    if (status === 410) {
      return (
        <MobileError
          title="Lien expiré ou révoqué"
          message="Ce lien d'inventaire n'est plus utilisable. Demandez un nouveau lien à votre responsable."
        />
      )
    }
    return (
      <MobileError
        title="Lien introuvable"
        message="Vérifiez l'adresse, ou demandez-en un nouveau."
      />
    )
  }

  const data = resolveQ.data!
  if (data.inventoryStatus === 'CLOSED') {
    return (
      <MobileError
        title="Inventaire clôturé"
        message={`L'inventaire « ${data.inventoryName} » est terminé. Aucune saisie possible.`}
      />
    )
  }

  return (
    <MobileShell
      title={data.inventoryName}
      subtitle={`${data.operatorName}${data.site ? ` · ${data.site.name}` : ''}`}
    >
      {locationsQ.isLoading ? (
        <div className="pt-8 flex justify-center text-[--k-muted]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Choisissez une zone</h2>
            {breadcrumb.length > 0 && (
              <button
                type="button"
                onClick={() => setParentId(null)}
                className="text-[12px] text-[--k-primary]"
              >
                Racine
              </button>
            )}
          </div>

          {breadcrumb.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-[--k-muted]">
              {breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <button onClick={() => setParentId(b.id)} className="underline">
                    {b.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2]/30 p-6 text-center">
              <MapPin className="mx-auto h-6 w-6 text-[--k-muted] mb-2" />
              <p className="text-[13px] text-[--k-muted]">
                {parentId ? 'Aucune sous-zone — saisir ici ?' : 'Aucune zone définie.'}
              </p>
              {parentId && (
                <button
                  type="button"
                  onClick={() => navigate(`/m/${linkId}/zone/${parentId}`)}
                  className="mt-3 rounded-lg bg-[--k-primary] px-4 py-2 text-white text-[14px] font-medium"
                >
                  Saisir dans cette zone
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((loc) => {
                const hasChildren = (locationsQ.data || []).some(
                  (l) => l.parentId === loc.id,
                )
                return (
                  <li
                    key={loc.id}
                    className="rounded-xl border border-[--k-border] bg-[--k-surface] flex"
                  >
                    <Link
                      to={`/m/${linkId}/zone/${loc.id}`}
                      className="flex-1 flex items-center gap-3 px-4 py-3"
                    >
                      <div className="rounded-lg bg-[--k-surface-2] p-2 text-[--k-muted]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">{loc.name}</div>
                        <div className="text-[11px] text-[--k-muted]">
                          {hasChildren ? 'Contient des sous-zones' : 'Saisir ici'}
                        </div>
                      </div>
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setParentId(loc.id)}
                        className="border-l border-[--k-border] px-4 text-[--k-muted]"
                        aria-label="Explorer"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </MobileShell>
  )
}
