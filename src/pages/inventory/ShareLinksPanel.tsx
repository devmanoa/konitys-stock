import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Link2, Copy, Check, Trash2, Plus, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import OperatorAvatar from '../../components/OperatorAvatar'

interface DirectoryUser {
  id: string
  keycloakId: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  photoNom: string | null
}

interface ShareLink {
  id: string
  inventoryId: string
  operatorUserId: string
  operatorName: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  lastUsedAt: string | null
  operatorUser: { id: string; fullName: string | null; photoNom: string | null } | null
  _count?: { entries: number; unknowns: number }
}

/**
 * Admin panel on the InventoryDetail page: generate a public mobile link
 * for a Keycloak user, list active links, copy each link, revoke.
 *
 * The link points at `${frontend origin}/m/{linkId}` — no auth required.
 */
export default function ShareLinksPanel({
  inventoryId,
  inventoryClosed,
}: {
  inventoryId: string
  inventoryClosed: boolean
}) {
  const qc = useQueryClient()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const linksQ = useQuery({
    queryKey: ['inventory-share-links', inventoryId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ShareLink[] }>(
        `/inventories/${inventoryId}/share-links`,
      )
      return res.data.data
    },
  })

  const usersQ = useQuery({
    queryKey: ['users-directory'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DirectoryUser[] }>('/users')
      return res.data.data
    },
    staleTime: 60_000,
  })

  const createM = useMutation({
    mutationFn: async (operatorUserId: string) => {
      const res = await api.post<{ success: boolean; data: ShareLink }>(
        `/inventories/${inventoryId}/share-links`,
        { operatorUserId },
      )
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-share-links', inventoryId] })
      setPickerOpen(false)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Impossible de générer le lien')
    },
  })

  const revokeM = useMutation({
    mutationFn: (linkId: string) => api.delete(`/share-links/${linkId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['inventory-share-links', inventoryId] }),
  })

  // Suggest only users that don't already have an active link for this inventory.
  const availableUsers = useMemo(() => {
    const active = new Set(
      (linksQ.data || [])
        .filter((l) => !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt) > new Date()))
        .map((l) => l.operatorUserId),
    )
    return (usersQ.data || []).filter((u) => !active.has(u.id))
  }, [linksQ.data, usersQ.data])

  const activeLinks = (linksQ.data || []).filter((l) => !l.revokedAt)

  const buildUrl = (linkId: string) => `${window.location.origin}/m/${linkId}`

  const handleCopy = async (linkId: string) => {
    try {
      await navigator.clipboard.writeText(buildUrl(linkId))
      setCopiedId(linkId)
      setTimeout(() => setCopiedId((c) => (c === linkId ? null : c)), 1800)
    } catch {
      window.prompt('Copiez ce lien :', buildUrl(linkId))
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[--k-primary]" />
            <h3 className="text-[14px] font-semibold">Liens mobiles</h3>
            <span className="text-[11px] text-[--k-muted]">
              {activeLinks.length} actif{activeLinks.length > 1 ? 's' : ''}
            </span>
          </div>
          {!inventoryClosed && (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => setPickerOpen((o) => !o)}
                data-perm="stock:inventories.share-links.create"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nouveau lien
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
              {pickerOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-[--k-border] bg-[--k-surface] shadow-lg z-10">
                  <div className="px-3 py-2 border-b border-[--k-border] text-[11px] text-[--k-muted]">
                    Choisissez un opérateur Keycloak
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {usersQ.isLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-[--k-muted]" />
                      </div>
                    )}
                    {!usersQ.isLoading && availableUsers.length === 0 && (
                      <p className="px-3 py-4 text-[12px] text-[--k-muted] italic">
                        Tous les utilisateurs connus ont déjà un lien actif.
                      </p>
                    )}
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => createM.mutate(u.id)}
                        disabled={createM.isPending}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-[--k-surface-2] disabled:opacity-50"
                      >
                        <OperatorAvatar name={u.fullName || ''} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">
                            {u.fullName || u.firstName || '—'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-[--k-border] flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="text-[11px] text-[--k-muted]"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {inventoryClosed && (
          <p className="text-[12px] italic text-[--k-muted] mb-3">
            Inventaire clôturé : impossible de générer de nouveaux liens.
          </p>
        )}

        {linksQ.isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-[--k-muted]" />
          </div>
        ) : activeLinks.length === 0 ? (
          <p className="text-[12px] text-[--k-muted] italic">
            Aucun lien actif. Cliquez sur « Nouveau lien » pour permettre à un opérateur
            de saisir l'inventaire depuis son téléphone.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeLinks.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2"
              >
                <OperatorAvatar name={l.operatorName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{l.operatorName}</div>
                  <div className="text-[11px] text-[--k-muted] truncate">
                    {l._count
                      ? `${l._count.entries + l._count.unknowns} saisie(s)`
                      : 'Aucune saisie'}
                    {l.lastUsedAt
                      ? ` · vu le ${new Date(l.lastUsedAt).toLocaleDateString('fr-FR')}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(l.id)}
                  className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-primary]"
                  title="Copier le lien"
                >
                  {copiedId === l.id ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Révoquer le lien pour ${l.operatorName} ?`)) {
                      revokeM.mutate(l.id)
                    }
                  }}
                  disabled={revokeM.isPending}
                  className="rounded-md p-1.5 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
                  title="Révoquer"
                  data-perm="stock:inventories.share-links.revoke"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
