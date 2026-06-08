import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, ChevronRight, Loader2, ClipboardList, PackageX, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import api from '../../services/api'
import { getFullImageUrl } from '../../utils/imageUrl'
import OperatorAvatar from '../../components/OperatorAvatar'
import type { ApiResponse, Location } from '../../types'
import { type Inventory, type InventoryEntry, STATE_LABEL, STATE_BADGE } from './types'

interface UnknownEntry {
  id: string
  description: string
  category: string | null
  quantity: number
  comment: string | null
  photoUrl: string | null
  operatorName: string | null
  createdAt: string
  location?: { id: string; name: string } | null
}

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [parentId, setParentId] = useState<string | null>(null)
  const [tab, setTab] = useState<'entries' | 'unknowns'>('entries')

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

  // All entries for this inventory (across zones). Capped at 100 — for a full
  // export the admin should hit the API directly until we add a paginated list.
  //
  // refetchOnMount: 'always' so navigating back here from /zone/:locationId
  // always shows the latest saisies, even if invalidation was missed.
  const { data: entries, refetch: refetchEntries } = useQuery({
    queryKey: ['inventory-entries-all', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<InventoryEntry[]>>(
        `/inventories/${id}/entries?limit=100`,
      )
      return res.data?.data || []
    },
    enabled: !!id,
    refetchOnMount: 'always',
  })

  const { data: unknowns } = useQuery({
    queryKey: ['inventory-unknowns-all', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UnknownEntry[]>>(
        `/inventories/${id}/unknowns`,
      )
      return res.data?.data || []
    },
    enabled: !!id,
    refetchOnMount: 'always',
  })

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/inventories/${id}/entries/${entryId}`)
    },
    onSuccess: () => {
      refetchEntries()
      qc.invalidateQueries({ queryKey: ['inventory', id] })
    },
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <div className="mb-3 flex items-center gap-1 border-b border-[--k-border] -mx-4 px-4 -mt-4 pt-2 sm:-mx-6 sm:px-6">
            <TabButton
              active={tab === 'entries'}
              onClick={() => setTab('entries')}
              icon={ClipboardList}
              label="Saisies"
              count={entries?.length ?? inv._count?.entries ?? 0}
            />
            <TabButton
              active={tab === 'unknowns'}
              onClick={() => setTab('unknowns')}
              icon={PackageX}
              label="Produits non trouvés"
              count={unknowns?.length ?? inv._count?.unknowns ?? 0}
            />
          </div>

          {tab === 'entries' ? (
            !entries || entries.length === 0 ? (
              <EmptyBlock
                icon={ClipboardList}
                title="Aucune saisie"
                subtitle="Choisissez une zone pour commencer."
              />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                      <th className="px-4 py-2 sm:px-6">Heure</th>
                      <th className="px-4 py-2">Produit</th>
                      <th className="px-4 py-2">Zone</th>
                      <th className="px-4 py-2">Qté / N° série</th>
                      <th className="px-4 py-2">État</th>
                      <th className="px-4 py-2">Opérateur</th>
                      <th className="px-4 py-2 sm:px-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--k-border]">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-[--k-surface-2]/30">
                        <td className="px-4 py-2 sm:px-6 font-mono text-[11px] text-[--k-muted] tabular-nums">
                          {new Date(e.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {e.product.imageUrl ? (
                              <img
                                src={getFullImageUrl(e.product.imageUrl)}
                                alt=""
                                className="h-7 w-7 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-[--k-surface-2] text-[--k-muted]">
                                <ClipboardList className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[--k-text]">
                                {e.product.description || e.product.reference}
                              </div>
                              <div className="font-mono text-[10px] text-[--k-muted]">
                                {e.product.reference}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[--k-muted]">
                          {e.location?.name || <span className="italic">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {e.product.hasSerialNumber ? (
                            <span className="font-mono text-[11px]">
                              {e.serialNumber || <span className="italic text-[--k-muted]">inconnu</span>}
                            </span>
                          ) : (
                            <span className="font-medium tabular-nums">{e.quantity}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_BADGE[e.state]}`}
                          >
                            {STATE_LABEL[e.state]}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <OperatorAvatar name={e.operatorName} size="xs" />
                        </td>
                        <td className="px-4 py-2 sm:px-6">
                          <button
                            type="button"
                            onClick={() => deleteEntryMutation.mutate(e.id)}
                            className="rounded p-1 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-danger]"
                            title="Supprimer cette saisie"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : !unknowns || unknowns.length === 0 ? (
            <EmptyBlock
              icon={PackageX}
              title="Aucun produit non trouvé"
              subtitle="Tout ce qui a été vu sur le terrain a pu être rattaché à un produit du catalogue."
            />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="px-4 py-2 sm:px-6">Heure</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Catégorie</th>
                    <th className="px-4 py-2">Zone</th>
                    <th className="px-4 py-2 text-right">Qté</th>
                    <th className="px-4 py-2">Opérateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {unknowns.map((u) => (
                    <tr key={u.id} className="hover:bg-[--k-surface-2]/30">
                      <td className="px-4 py-2 sm:px-6 font-mono text-[11px] text-[--k-muted] tabular-nums">
                        {new Date(u.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-[--k-text]">{u.description}</div>
                        {u.comment && (
                          <div className="mt-0.5 text-[11px] italic text-[--k-muted]">{u.comment}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[--k-muted]">
                        {u.category || <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-[--k-muted]">
                        {u.location?.name || <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{u.quantity}</td>
                      <td className="px-4 py-2">
                        <OperatorAvatar name={u.operatorName} size="xs" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: typeof ClipboardList
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition border-b-2 -mb-px ${
        active
          ? 'border-[--k-primary] text-[--k-primary]'
          : 'border-transparent text-[--k-muted] hover:text-[--k-text]'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
          active ? 'bg-[--k-primary]/15 text-[--k-primary]' : 'bg-[--k-surface-2] text-[--k-muted]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function EmptyBlock({ icon: Icon, title, subtitle }: { icon: typeof ClipboardList; title: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2]/30 px-3 py-8 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-[--k-muted]" />
      <div className="text-[14px] font-medium text-[--k-text]">{title}</div>
      {subtitle && <p className="mt-1 text-[12px] text-[--k-muted]">{subtitle}</p>}
    </div>
  )
}
