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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import Button from './ui/Button'
import Input from './ui/Input'
import { useToast } from './ui/Toast'
import api from '../services/api'
import type { ApiResponse, Location, Site } from '../types'

interface Props {
  sites: Site[]
}

export default function LocationsManager({ sites }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newRootBySite, setNewRootBySite] = useState<Record<string, string>>({})
  const [newChildByParent, setNewChildByParent] = useState<Record<string, string>>({})

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Location[]>>('/locations')
      return res.data?.data || []
    },
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

  // Build per-site roots and per-root children maps from the flat list.
  // The API returns every row with parent + children embedded, but we re-tree
  // them to keep the rendering deterministic.
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

  const handleAddRoot = (siteId: string) => {
    const name = (newRootBySite[siteId] || '').trim()
    if (!name) return
    createMutation.mutate({ siteId, name }, {
      onSuccess: () => {
        setNewRootBySite((prev) => ({ ...prev, [siteId]: '' }))
      },
    })
  }

  const handleAddChild = (parentId: string) => {
    const name = (newChildByParent[parentId] || '').trim()
    if (!name) return
    createMutation.mutate({ parentId, name }, {
      onSuccess: () => {
        setNewChildByParent((prev) => ({ ...prev, [parentId]: '' }))
      },
    })
  }

  const renderRoot = (root: Location) => {
    const kids = childrenByParent.get(root.id) || []
    const isCollapsed = !!collapsed[root.id]
    return (
      <div key={root.id} className="rounded-lg border border-[--k-border]">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setCollapsed((p) => ({ ...p, [root.id]: !p[root.id] }))}
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
            onClick={() => deleteMutation.mutate(root.id)}
            className="rounded-md p-1 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
            title="Supprimer (et tous ses sous-emplacements)"
            disabled={deleteMutation.isPending}
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
                  onClick={() => deleteMutation.mutate(child.id)}
                  className="rounded-md p-1 text-[--k-muted] hover:bg-red-50 hover:text-red-600"
                  title="Supprimer"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pl-7 pr-2 pt-1">
              <Input
                value={newChildByParent[root.id] || ''}
                onChange={(e) =>
                  setNewChildByParent((p) => ({ ...p, [root.id]: e.target.value }))
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
                disabled={!newChildByParent[root.id]?.trim() || createMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

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
          Vous pourrez ensuite affecter un emplacement à chaque produit.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-[--k-muted]" />
          </div>
        ) : (
          <div className="space-y-6">
            {sites
              .filter((s) => s.isActive)
              .map((site) => {
                const roots = rootsBySite.get(site.id) || []
                return (
                  <div key={site.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <Warehouse className="h-4 w-4 text-[--k-primary]" />
                      <span className="font-semibold text-[--k-text]">{site.name}</span>
                      <span className="text-[11px] text-[--k-muted]">
                        ({roots.length} emplacement{roots.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {roots.map(renderRoot)}
                      <div className="flex items-center gap-2">
                        <Input
                          value={newRootBySite[site.id] || ''}
                          onChange={(e) =>
                            setNewRootBySite((p) => ({ ...p, [site.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddRoot(site.id)
                            }
                          }}
                          placeholder="Nom de l'emplacement (ex : Allée 1)"
                          className="text-[13px]"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAddRoot(site.id)}
                          disabled={!newRootBySite[site.id]?.trim() || createMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}

            {orphanRoots.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs italic text-amber-700">
                    Emplacements non rattachés à un site ({orphanRoots.length})
                  </span>
                </div>
                <p className="text-xs text-[--k-muted] mb-2">
                  Ces emplacements proviennent de l'ancien champ texte libre. Réorganisez-les
                  en les supprimant et en les recréant sous le bon site.
                </p>
                <div className="space-y-2">{orphanRoots.map(renderRoot)}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
