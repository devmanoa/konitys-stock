import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  MapPin,
  Loader2,
  Warehouse,
  Pencil,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import Modal from './ui/Modal'
import { useToast } from './ui/Toast'
import api from '../services/api'
import type { ApiResponse, Location, Site } from '../types'

interface Props {
  sites: Site[]
}

export default function LocationsManager({ sites }: Props) {
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Location[]>>('/locations')
      return res.data?.data || []
    },
  })

  // Re-tree the flat list once for the read-only summary.
  const rootsBySite = new Map<string, Location[]>()
  const childrenByParent = new Map<string, Location[]>()
  const orphanRoots: Location[] = []
  for (const loc of locations) {
    if (loc.parentId) {
      const arr = childrenByParent.get(loc.parentId) || []
      arr.push(loc)
      childrenByParent.set(loc.parentId, arr)
    } else if (loc.siteId) {
      const arr = rootsBySite.get(loc.siteId) || []
      arr.push(loc)
      rootsBySite.set(loc.siteId, arr)
    } else {
      orphanRoots.push(loc)
    }
  }

  const editingSite = editingSiteId ? sites.find((s) => s.id === editingSiteId) || null : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Emplacements de stockage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-[--k-muted] mb-4">
          Définissez les emplacements de chaque lieu jusqu'à 2 niveaux (ex : « Allée 1 / Rack A »).
          Cliquez sur « Gérer » pour modifier les emplacements d'un site.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-[--k-muted]" />
          </div>
        ) : (
          <div className="space-y-4">
            {sites
              .filter((s) => s.isActive)
              .map((site) => {
                const roots = rootsBySite.get(site.id) || []
                return (
                  <div
                    key={site.id}
                    className="rounded-lg border border-[--k-border] bg-[--k-surface] p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Warehouse className="h-4 w-4 text-[--k-primary]" />
                      <span className="font-semibold text-[--k-text] flex-1">{site.name}</span>
                      <span className="text-[11px] text-[--k-muted]">
                        {roots.length} emplacement{roots.length > 1 ? 's' : ''}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingSiteId(site.id)}
                        data-perm="stock:sites.locations.manage"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Gérer
                      </Button>
                    </div>

                    {roots.length === 0 ? (
                      <p className="text-[12px] italic text-[--k-muted] pl-6">
                        Aucun emplacement défini.
                      </p>
                    ) : (
                      <ul className="pl-6 space-y-1">
                        {roots.map((root) => {
                          const kids = childrenByParent.get(root.id) || []
                          return (
                            <li key={root.id} className="text-[13px] text-[--k-text]">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-[--k-muted]" />
                                <span>{root.name}</span>
                                {kids.length > 0 && (
                                  <span className="text-[11px] text-[--k-muted]">
                                    ({kids.length} sous-emplacement{kids.length > 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                              {kids.length > 0 && (
                                <ul className="pl-6 mt-0.5 space-y-0.5">
                                  {kids.map((k) => (
                                    <li
                                      key={k.id}
                                      className="flex items-center gap-2 text-[12px] text-[--k-muted]"
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                      {k.name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}

            {orphanRoots.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs italic text-amber-700">
                    Emplacements non rattachés à un site ({orphanRoots.length})
                  </span>
                </div>
                <p className="text-xs text-amber-700/80">
                  Ces emplacements proviennent d'un ancien format. Modifiez-les depuis la page
                  d'un site pour les rattacher correctement.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <LocationsEditModal
        site={editingSite}
        onClose={() => setEditingSiteId(null)}
      />
    </Card>
  )
}

function LocationsEditModal({
  site,
  onClose,
}: {
  site: Site | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newRoot, setNewRoot] = useState('')
  const [newChildByParent, setNewChildByParent] = useState<Record<string, string>>({})

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Location[]>>('/locations')
      return res.data?.data || []
    },
    enabled: !!site,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: {
      siteId?: string | null
      parentId?: string | null
      name: string
    }) => {
      const res = await api.post<ApiResponse<Location>>('/locations', payload)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: (err: any) => {
      toast.error(
        'Erreur',
        err?.response?.data?.error || "Impossible de créer l'emplacement",
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/locations/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Emplacement supprimé')
    },
    onError: () => {
      toast.error('Erreur', "Impossible de supprimer l'emplacement")
    },
  })

  if (!site) return null

  const siteRoots = locations.filter((l) => l.siteId === site.id && !l.parentId)
  const childrenOf = (parentId: string) =>
    locations.filter((l) => l.parentId === parentId)

  const handleAddRoot = () => {
    const name = newRoot.trim()
    if (!name) return
    createMutation.mutate(
      { siteId: site.id, name },
      { onSuccess: () => setNewRoot('') },
    )
  }

  const handleAddChild = (parentId: string) => {
    const name = (newChildByParent[parentId] || '').trim()
    if (!name) return
    createMutation.mutate(
      { parentId, name },
      {
        onSuccess: () =>
          setNewChildByParent((p) => ({ ...p, [parentId]: '' })),
      },
    )
  }

  const handleDelete = (loc: Location) => {
    const kids = childrenOf(loc.id)
    const msg = kids.length
      ? `Supprimer « ${loc.name} » et ses ${kids.length} sous-emplacement(s) ?`
      : `Supprimer « ${loc.name} » ?`
    if (confirm(msg)) deleteMutation.mutate(loc.id)
  }

  return (
    <Modal
      isOpen={!!site}
      onClose={onClose}
      title={`Emplacements — ${site.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-[--k-muted]">
          Ajoutez, modifiez ou supprimez les emplacements de ce site. Jusqu'à 2 niveaux
          (ex : « Allée 1 / Rack A »).
        </p>

        <div className="space-y-2">
          {siteRoots.length === 0 && (
            <div className="rounded-lg border border-dashed border-[--k-border] bg-[--k-surface-2]/30 px-3 py-6 text-center">
              <MapPin className="mx-auto mb-2 h-5 w-5 text-[--k-muted]" />
              <p className="text-[13px] text-[--k-muted]">
                Aucun emplacement pour ce site. Ajoutez-en un ci-dessous.
              </p>
            </div>
          )}

          {siteRoots.map((root) => {
            const kids = childrenOf(root.id)
            const isCollapsed = !!collapsed[root.id]
            return (
              <div key={root.id} className="rounded-lg border border-[--k-border]">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((p) => ({ ...p, [root.id]: !p[root.id] }))
                    }
                    className="text-[--k-muted] hover:text-[--k-text]"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <MapPin className="h-4 w-4 text-[--k-muted]" />
                  <span className="font-medium text-[--k-text] flex-1">{root.name}</span>
                  {kids.length > 0 && (
                    <span className="text-[11px] text-[--k-muted]">
                      {kids.length} sous-emplacement{kids.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(root)}
                    className="rounded-md p-1 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
                    title="Supprimer (et tous ses sous-emplacements)"
                    disabled={deleteMutation.isPending}
                    data-perm="stock:sites.locations.delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="border-t border-[--k-border] p-2 space-y-1.5">
                    {kids.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 pl-7 pr-2 py-1.5 rounded hover:bg-[--k-surface-2]/40"
                      >
                        <ChevronRight className="h-3 w-3 text-[--k-muted]" />
                        <span className="text-[13px] flex-1">{child.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(child)}
                          className="rounded-md p-1 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
                          disabled={deleteMutation.isPending}
                          data-perm="stock:sites.locations.delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pl-7 pr-2 pt-1">
                      <Input
                        value={newChildByParent[root.id] || ''}
                        onChange={(e) =>
                          setNewChildByParent((p) => ({
                            ...p,
                            [root.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddChild(root.id)
                          }
                        }}
                        placeholder="Nom du sous-emplacement (ex : Rack A)"
                        className="text-[13px]"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddChild(root.id)}
                        disabled={
                          !newChildByParent[root.id]?.trim() ||
                          createMutation.isPending
                        }
                        data-perm="stock:sites.locations.create"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center gap-2 pt-2 border-t border-[--k-border]">
            <Input
              value={newRoot}
              onChange={(e) => setNewRoot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddRoot()
                }
              }}
              placeholder="Nom de l'emplacement (ex : Allée 1)"
              className="text-[13px]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddRoot}
              disabled={!newRoot.trim() || createMutation.isPending}
              data-perm="stock:sites.locations.create"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
