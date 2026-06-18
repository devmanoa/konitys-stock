import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, ClipboardList, PackageX } from 'lucide-react'
import publicApi from '../../../services/publicApi'
import MobileShell from './MobileShell'
import { getFullImageUrl } from '../../../utils/imageUrl'

interface RecentEntry {
  id: string
  quantity: number
  serialNumber: string | null
  createdAt: string
  product: {
    id: string
    reference: string
    description: string | null
    imageUrl: string | null
    hasSerialNumber: boolean
  }
  location: { id: string; name: string } | null
}

interface RecentUnknown {
  id: string
  description: string
  category: string | null
  quantity: number
  createdAt: string
  location: { id: string; name: string } | null
}

export default function MobileInventoryRecent() {
  const { linkId } = useParams<{ linkId: string }>()
  const qc = useQueryClient()

  const recentQ = useQuery({
    queryKey: ['m-recent', linkId],
    queryFn: async () => {
      const res = await publicApi.get<{
        success: boolean
        data: { entries: RecentEntry[]; unknowns: RecentUnknown[] }
      }>(`inventory/${linkId}/my-recent`)
      return res.data.data
    },
    refetchOnMount: 'always',
  })

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) =>
      publicApi.delete(`inventory/${linkId}/entries/${entryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m-recent', linkId] }),
  })

  const deleteUnknown = useMutation({
    mutationFn: (id: string) =>
      publicApi.delete(`inventory/${linkId}/unknowns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m-recent', linkId] }),
  })

  return (
    <MobileShell title="Mes saisies" subtitle="30 dernières de cet appareil">
      {recentQ.isLoading ? (
        <div className="pt-8 flex justify-center text-[--k-muted]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <Section
            title="Produits saisis"
            empty="Aucune saisie pour le moment."
            count={recentQ.data?.entries.length ?? 0}
          >
            {(recentQ.data?.entries || []).map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-3 py-2.5"
              >
                {e.product.imageUrl ? (
                  <img
                    src={getFullImageUrl(e.product.imageUrl)}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-[--k-surface-2]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {e.product.description || e.product.reference}
                  </div>
                  <div className="text-[11px] text-[--k-muted]">
                    {e.product.hasSerialNumber
                      ? `SN ${e.serialNumber || '—'}`
                      : `Qté ${e.quantity}`}
                    {e.location ? ` · ${e.location.name}` : ''}
                  </div>
                  <div className="font-mono text-[10px] text-[--k-muted]">{e.product.reference}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Supprimer cette saisie ?')) deleteEntry.mutate(e.id)
                  }}
                  className="p-2 text-[--k-muted]"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Section>

          <Section
            title="Produits non trouvés"
            empty="Aucun produit non trouvé."
            count={recentQ.data?.unknowns.length ?? 0}
          >
            {(recentQ.data?.unknowns || []).map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-3 py-2.5"
              >
                <PackageX className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{u.description}</div>
                  <div className="text-[11px] text-[--k-muted]">
                    Qté {u.quantity}
                    {u.category ? ` · ${u.category}` : ''}
                    {u.location ? ` · ${u.location.name}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Supprimer cette ligne ?')) deleteUnknown.mutate(u.id)
                  }}
                  className="p-2 text-[--k-muted]"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Section>
        </>
      )}
    </MobileShell>
  )
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[--k-muted] mb-2">
        {title} {count > 0 && <span className="ml-1 normal-case">({count})</span>}
      </h2>
      {count === 0 ? (
        <div className="rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2]/30 p-4 text-center text-[12px] text-[--k-muted]">
          <ClipboardList className="mx-auto h-5 w-5 mb-1" />
          {empty}
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}
