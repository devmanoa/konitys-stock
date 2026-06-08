import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, ChevronRight, Loader2, ClipboardList } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import api from '../../services/api'
import type { ApiResponse, Location } from '../../types'
import type { Inventory } from './types'

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [parentId, setParentId] = useState<string | null>(null)

  const { data: inv, isLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Inventory>>(`/inventories/${id}`)
      return res.data?.data
    },
    enabled: !!id,
  })

  const { data: locations } = useQuery({
    queryKey: ['locations', inv?.siteId],
    queryFn: async () => {
      const q = inv?.siteId ? `?siteId=${inv.siteId}` : ''
      const res = await api.get<ApiResponse<Location[]>>(`/locations${q}`)
      return res.data?.data || []
    },
    enabled: !!inv,
  })

  const currentList = useMemo(() => {
    if (!locations) return []
    return locations.filter((l: any) => (l.parentId || null) === parentId)
  }, [locations, parentId])

  const breadcrumb = useMemo(() => {
    if (!locations || !parentId) return [] as Location[]
    const trail: Location[] = []
    let cursor: Location | undefined = locations.find((l) => l.id === parentId)
    while (cursor) {
      trail.unshift(cursor)
      cursor = locations.find((l) => l.id === (cursor as any).parentId)
    }
    return trail
  }, [locations, parentId])

  if (isLoading || !inv) {
    return (
      <div className="flex items-center justify-center py-12 text-[--k-muted]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={inv.name}
        subtitle={inv.site?.name ? `Site : ${inv.site.name}` : 'Choisissez la zone à inventorier'}
      >
        <Button variant="secondary" size="sm" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tous les inventaires
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[--k-text]">Choix de la zone</h3>
            {breadcrumb.length > 0 && (
              <button
                type="button"
                onClick={() => setParentId(null)}
                className="text-[12px] text-[--k-primary] hover:underline"
              >
                Revenir à la racine
              </button>
            )}
          </div>

          {breadcrumb.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-[--k-muted]">
              <button onClick={() => setParentId(null)} className="hover:underline">
                Racine
              </button>
              {breadcrumb.map((b) => (
                <span key={b.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button onClick={() => setParentId(b.id)} className="hover:underline">
                    {b.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {currentList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2]/30 px-3 py-8 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-[--k-muted]" />
              <p className="text-[14px] font-medium text-[--k-text]">
                {parentId ? 'Aucune sous-zone' : 'Aucune zone trouvée'}
              </p>
              {parentId && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/inventory/${id}/zone/${parentId}`)}
                >
                  Saisir dans cette zone
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentList.map((loc: any) => {
                const hasChildren = locations?.some((l: any) => l.parentId === loc.id)
                return (
                  <div
                    key={loc.id}
                    className="flex items-stretch gap-2 rounded-xl border border-[--k-border] bg-[--k-surface] transition hover:border-[--k-primary]/60 hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/inventory/${id}/zone/${loc.id}`)}
                      className="flex flex-1 items-center gap-3 px-3 py-3 text-left"
                    >
                      <div className="rounded-lg bg-[--k-surface-2] p-2 text-[--k-muted]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[--k-text]">
                          {loc.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[--k-muted]">
                          {hasChildren ? 'Contient des sous-zones' : 'Saisir ici'}
                        </div>
                      </div>
                    </button>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setParentId(loc.id)}
                        className="border-l border-[--k-border] px-3 text-[--k-muted] hover:bg-[--k-surface-2]"
                        title="Explorer les sous-zones"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center gap-2 text-[13px] text-[--k-muted]">
            <ClipboardList className="h-4 w-4" />
            <span>{inv._count?.entries ?? 0} saisies enregistrées</span>
            {(inv._count?.unknowns ?? 0) > 0 && (
              <>
                <span>·</span>
                <span>{inv._count!.unknowns} produits non trouvés</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
