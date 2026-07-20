import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Package, QrCode } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import ProductSearch from '../components/ui/ProductSearch'
import RichTextEditor from '../components/ui/RichTextEditor'
import PrintLabels, { type LabelPayload } from '../components/PrintLabels'
import { useToast } from '../components/ui/Toast'
import api from '../services/api'
import type { ApiResponse, AssemblyType, PartCategory, PartType, Product } from '../types'
import { PART_TYPE_LABEL } from '../types'

const UNCATEGORIZED_KEY = '__uncat__'
// Tabs par type de piece — pas de tab "Tous" (on force le filtre).
type TypeTab = PartType
const TYPE_TABS: TypeTab[] = ['EQUIPMENT', 'PROTECTION', 'HARDWARE']

type AssemblyTypeItemDraft = {
  key: string
  productId: string
  product: {
    id: string
    reference: string
    description?: string
    imageUrl?: string
    partType?: PartType | null
  } | null
  quantity: number
  partCategoryId: string
}

type AssemblyTypePayload = {
  name: string
  description?: string
  items: { productId: string; quantity: number; partCategoryId: string | null }[]
}

export default function AssemblyTypeEdit() {
  const { id } = useParams<{ id: string }>()
  const isCreating = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<AssemblyTypeItemDraft[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [printLabels, setPrintLabels] = useState<LabelPayload[] | null>(null)
  // Tab actif pour filtrer les composants par type de piece
  // (Equipement / Protection / Visserie). Persistant en localStorage.
  const [activeTypeTab, setActiveTypeTab] = useState<TypeTab>(() => {
    try {
      const v = localStorage.getItem('assemblytype_edit_tab')
      if (v && (TYPE_TABS as string[]).includes(v)) return v as TypeTab
    } catch {
      /* ignore */
    }
    return 'EQUIPMENT'
  })
  useEffect(() => {
    try {
      localStorage.setItem('assemblytype_edit_tab', activeTypeTab)
    } catch {
      /* ignore */
    }
  }, [activeTypeTab])

  // Compteurs par tab (calcules sur TOUS les items, pas seulement le tab actif).
  const countsByType = useMemo(() => {
    const counts: Record<TypeTab, number> = {
      EQUIPMENT: 0,
      PROTECTION: 0,
      HARDWARE: 0,
    }
    for (const it of items) {
      const t = it.product?.partType
      if (t) counts[t] += 1
    }
    return counts
  }, [items])

  const { data: assemblyType, isLoading: isLoadingType } = useQuery({
    queryKey: ['assembly-type', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssemblyType>>(`/assembly-types/${id}`)
      return res.data?.data
    },
    enabled: !isCreating && !!id,
  })

  const { data: partCategories } = useQuery({
    queryKey: ['part-categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PartCategory[]>>('/part-categories')
      return res.data?.data || []
    },
  })

  useEffect(() => {
    if (assemblyType) {
      setName(assemblyType.name || '')
      setDescription(assemblyType.description || '')
      setItems(
        (assemblyType.items || []).map((it, idx) => ({
          key: `existing-${it.id}-${idx}`,
          productId: it.productId,
          // Backend expose partType dans product (voir assemblyTypeController.ts).
          product: it.product,
          quantity: it.quantity,
          partCategoryId: it.partCategoryId || '',
        })),
      )
    }
  }, [assemblyType])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((it) => it.productId && it.quantity > 0)
      const payload: AssemblyTypePayload = {
        name,
        description: description || undefined,
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          partCategoryId: it.partCategoryId || null,
        })),
      }
      if (isCreating) {
        const res = await api.post<ApiResponse<AssemblyType>>('/assembly-types', payload)
        return res.data.data
      }
      const res = await api.put<ApiResponse<AssemblyType>>(`/assembly-types/${id}`, payload)
      return res.data.data
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['assembly-types'] })
      queryClient.invalidateQueries({ queryKey: ['assembly-type', id] })
      toast.success(
        isCreating ? 'Type de borne créé' : 'Type de borne modifié',
        isCreating ? 'Le type a été créé avec succès' : 'Les modifications ont été enregistrées',
      )
      if (isCreating && saved?.id) {
        navigate(`/settings/assembly-types/${saved.id}/edit`, { replace: true })
      } else {
        navigate('/settings')
      }
    },
    onError: () => {
      toast.error('Erreur', 'Impossible d’enregistrer le type de borne')
    },
  })

  // Filtre les items selon le tab actif (par partType).
  // Les items dont product n'est pas encore charge (nouvelles lignes vides)
  // restent visibles dans tous les tabs pour ne pas geler la saisie.
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (!it.productId) return true // ligne vide en cours d'ajout : garder
      return it.product?.partType === activeTypeTab
    })
  }, [items, activeTypeTab])

  // Group items by categoryId (localisation : Tete/Pied/Socle). Applique
  // sur les items DEJA filtres par partType.
  const groups = useMemo(() => {
    const map = new Map<string, AssemblyTypeItemDraft[]>()
    for (const cat of partCategories || []) {
      map.set(cat.id, [])
    }
    map.set(UNCATEGORIZED_KEY, [])
    for (const it of filteredItems) {
      const key = it.partCategoryId || UNCATEGORIZED_KEY
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return map
  }, [filteredItems, partCategories])

  const categoryLabel = (key: string) => {
    if (key === UNCATEGORIZED_KEY) return 'Sans catégorie'
    return partCategories?.find((c) => c.id === key)?.name || 'Catégorie supprimée'
  }

  const totalsByCategory = useMemo(() => {
    const out = new Map<string, number>()
    items.forEach((it) => {
      if (!it.productId) return
      const key = it.partCategoryId || UNCATEGORIZED_KEY
      out.set(key, (out.get(key) || 0) + (Number(it.quantity) || 0))
    })
    return out
  }, [items])

  const totalPieces = useMemo(
    () => items.reduce((s, it) => s + (it.productId ? Number(it.quantity) || 0 : 0), 0),
    [items],
  )

  const addItemToCategory = (categoryKey: string) => {
    setItems((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        productId: '',
        product: null,
        quantity: 1,
        partCategoryId: categoryKey === UNCATEGORIZED_KEY ? '' : categoryKey,
      },
    ])
    // Make sure the section is expanded so the user sees the new row.
    setCollapsed((prev) => ({ ...prev, [categoryKey]: false }))
  }

  const updateItem = (key: string, patch: Partial<AssemblyTypeItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  const handleProductChange = (key: string, productId: string, product: Product | null) => {
    updateItem(key, {
      productId,
      product: product
        ? {
            id: product.id,
            reference: product.reference,
            description: product.description,
            imageUrl: product.imageUrl,
            partType: product.partType ?? null,
          }
        : null,
    })
    // Si le produit choisi a un partType different du tab actif, on switch
    // automatiquement pour ne pas perdre visuellement la ligne qu'on vient
    // de saisir.
    if (product && product.partType && product.partType !== activeTypeTab) {
      setActiveTypeTab(product.partType)
    }
  }

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Build the rendering order: all known categories first (alpha), then uncategorized last.
  const orderedKeys = useMemo(() => {
    const cats = (partCategories || []).slice().sort((a, b) => a.name.localeCompare(b.name))
    return [...cats.map((c) => c.id), UNCATEGORIZED_KEY]
  }, [partCategories])

  if (!isCreating && isLoadingType) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
        <span className="ml-2 text-[--k-muted]">Chargement…</span>
      </div>
    )
  }

  if (!isCreating && !assemblyType) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Type de borne non trouvé</p>
        <Button variant="secondary" onClick={() => navigate('/settings')} className="mt-4">
          Retour aux paramètres
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[--k-text] truncate">
              {isCreating ? 'Nouveau type de borne' : `Modifier — ${assemblyType?.name}`}
            </h1>
            <p className="text-sm text-[--k-muted]">
              Composants regroupés par catégorie de pièces.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCreating && id && (
            <Button
              variant="secondary"
              onClick={() =>
                setPrintLabels([
                  {
                    qrValue: `${window.location.origin}/assembly-types/${id}`,
                    title: assemblyType?.name || name,
                    reference: assemblyType?.name || name,
                  },
                ])
              }
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            Annuler
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Enregistrement…' : isCreating ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nom *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex : Borne Classik"
          />
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[--k-text]">Description</label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Description optionnelle…"
              fetchMentions={() => []}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Composants nécessaires
              </div>
            </CardTitle>
            <span className="text-sm text-[--k-muted]">
              Total : <span className="font-semibold text-[--k-text]">{totalPieces}</span> pièce(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Tabs filtre par type de piece (Equipement / Protection / Visserie).
              Independant du groupement par PartCategory ci-dessous. */}
          <div className="flex items-center gap-1 border-b border-[--k-border] -mx-6 px-6">
            {TYPE_TABS.map((t) => {
              const label = PART_TYPE_LABEL[t]
              const count = countsByType[t]
              const active = activeTypeTab === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTypeTab(t)}
                  className={`relative px-3 py-2 text-[13px] font-medium transition ${
                    active
                      ? 'text-[--k-primary] border-b-2 border-[--k-primary] -mb-[1px]'
                      : 'text-[--k-muted] hover:text-[--k-text]'
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 inline-flex min-w-[18px] justify-center rounded-full px-1.5 text-[11px] tabular-nums ${
                      active
                        ? 'bg-[--k-primary]/10 text-[--k-primary]'
                        : 'bg-[--k-surface-2] text-[--k-muted]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {items.filter((it) => it.productId && !it.product?.partType).length > 0 && (
            <div className="rounded-lg bg-amber-50/60 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
              {items.filter((it) => it.productId && !it.product?.partType).length} composant(s) sans type de pièce ne s'affiche(nt) pas dans cet onglet — assigne un « Type de pièce » sur ces produits pour qu'ils apparaissent.
            </div>
          )}

          {orderedKeys.map((key) => {
            const rows = groups.get(key) || []
            // Hide a category section if it has no rows AND it's uncategorized — keep
            // known empty categories visible so the user can add into them.
            if (key === UNCATEGORIZED_KEY && rows.length === 0) return null
            const isCollapsed = !!collapsed[key]
            const subtotal = totalsByCategory.get(key) || 0

            return (
              <div key={key} className="rounded-xl border border-[--k-border]">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[--k-surface-2]/40 rounded-t-xl"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-[--k-muted]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[--k-muted]" />
                    )}
                    <span className="font-semibold text-[--k-text]">{categoryLabel(key)}</span>
                    <span className="text-xs text-[--k-muted]">
                      {rows.length} ligne{rows.length > 1 ? 's' : ''}
                      {subtotal > 0 && ` · ${subtotal} pièce${subtotal > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      addItemToCategory(key)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        addItemToCategory(key)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-[--k-border] bg-[--k-surface] px-2 py-1 text-xs font-medium text-[--k-text] hover:bg-[--k-surface-2]"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="border-t border-[--k-border] p-3 space-y-2">
                    {rows.length === 0 ? (
                      <p className="text-xs italic text-[--k-muted] py-1">
                        Aucun composant dans cette catégorie.
                      </p>
                    ) : (
                      rows.map((item) => (
                        <div
                          key={item.key}
                          className="flex flex-col gap-2 rounded-lg bg-[--k-surface-2]/60 p-2 sm:flex-row sm:items-start sm:gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <ProductSearch
                              label=""
                              onChange={(productId, product) =>
                                handleProductChange(item.key, productId, product)
                              }
                              initialProduct={item.product as Product | null}
                              assemblyTypeId={!isCreating ? id : undefined}
                              partCategoryId={key !== UNCATEGORIZED_KEY ? key : undefined}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 sm:w-24">
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(item.key, {
                                    quantity: parseInt(e.target.value) || 1,
                                  })
                                }
                                placeholder="Qté"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.key)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              title="Retirer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <PrintLabels
        isOpen={!!printLabels && printLabels.length > 0}
        onClose={() => setPrintLabels(null)}
        labels={printLabels || []}
      />
    </div>
  )
}
