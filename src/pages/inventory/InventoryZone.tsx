import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Search, Camera, PackageX, ChevronRight, X, ImagePlus, Loader2,
  Trash2, CheckCircle, AlertTriangle, ClipboardList,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import api from '../../services/api'
import { getFullImageUrl } from '../../utils/imageUrl'
import QrScannerModal, { type ParsedQr } from '../../components/QrScannerModal'
import type { ApiResponse, Product, Location } from '../../types'
import { type Inventory, type InventoryEntry, type ItemState, STATE_LABEL, STATE_BADGE } from './types'

export default function InventoryZone() {
  const { id, locationId } = useParams<{ id: string; locationId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  const [prefilledSerial, setPrefilledSerial] = useState<string | null>(null)
  const [unknownOpen, setUnknownOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)

  const { data: inv } = useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Inventory>>(`/inventories/${id}`)
      return res.data?.data
    },
    enabled: !!id,
  })

  const { data: location } = useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Location>>(`/locations/${locationId}`)
      return res.data?.data
    },
    enabled: !!locationId,
  })

  const { data: entries, refetch: refetchEntries } = useQuery({
    queryKey: ['inventory-entries', id, locationId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<InventoryEntry[]>>(
        `/inventories/${id}/entries?locationId=${locationId}&limit=15`,
      )
      return res.data?.data || []
    },
    enabled: !!id && !!locationId,
  })

  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchHits, isFetching: isSearching } = useQuery({
    queryKey: ['product-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return []
      const res = await api.get<any>(`/products?search=${encodeURIComponent(debouncedQuery)}&limit=10`)
      return (res.data?.data?.data || res.data?.data || []) as Product[]
    },
    enabled: !!debouncedQuery && !picked,
  })

  // Invalidate every cache that depends on this inventory's entries/unknowns
  // so the parent /inventory/:id page reflects the saisie when we navigate back.
  const invalidateAll = () => {
    refetchEntries()
    qc.invalidateQueries({ queryKey: ['inventory', id] })
    qc.invalidateQueries({ queryKey: ['inventory-entries-all', id] })
    qc.invalidateQueries({ queryKey: ['inventory-unknowns-all', id] })
    qc.invalidateQueries({ queryKey: ['zone-summary', id] })
    qc.invalidateQueries({ queryKey: ['inventories'] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/inventories/${id}/entries/${entryId}`)
    },
    onSuccess: invalidateAll,
  })

  const handleScan = async (parsed: ParsedQr) => {
    setScannerOpen(false)
    setScanError(null)
    if (parsed.kind === 'unknown') {
      setScanError(`QR non reconnu : ${parsed.raw.slice(0, 60)}`)
      return
    }
    setScanLoading(true)
    try {
      if (parsed.kind === 'product') {
        const res = await api.get<ApiResponse<Product>>(`/products/${parsed.id}`)
        const product = res.data?.data
        if (!product) {
          setScanError('Produit introuvable.')
          return
        }
        setPrefilledSerial(null)
        setPicked(product)
        return
      }
      const res = await api.get<ApiResponse<any>>(`/serial-items/${parsed.id}`)
      const item = res.data?.data
      if (!item) {
        setScanError('Numéro de série introuvable.')
        return
      }
      const prodRes = await api.get<ApiResponse<Product>>(`/products/${item.productId}`)
      const product = prodRes.data?.data
      if (!product) {
        setScanError('Produit lié au numéro de série introuvable.')
        return
      }
      setPrefilledSerial(item.serialNumber || null)
      setPicked(product)
    } catch (err) {
      console.error('Scan lookup failed:', err)
      setScanError('Erreur lors de la récupération du produit scanné.')
    } finally {
      setScanLoading(false)
    }
  }

  if (!inv || !location) {
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
        subtitle={`Zone : ${location.name}`}
      >
        <Button variant="secondary" size="sm" onClick={() => navigate(`/inventory/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Changer de zone
        </Button>
        <Button onClick={() => setFinishOpen(true)}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Terminer la zone
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        {/* Left column: search + form */}
        <div className="lg:col-span-2 space-y-4">
          {!picked && (
            <Card>
              <CardContent>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Scanner ou rechercher un produit…"
                    className="w-full rounded-lg border border-[--k-border] bg-[--k-surface] py-2.5 pl-9 pr-3 text-[14px] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[--k-muted] hover:bg-[--k-surface-2]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setScanError(null)
                      setScannerOpen(true)
                    }}
                    disabled={scanLoading}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {scanLoading ? 'Chargement…' : 'Scanner'}
                  </Button>
                  <Button variant="secondary" onClick={() => setUnknownOpen(true)}>
                    <PackageX className="mr-2 h-4 w-4" />
                    Produit non trouvé
                  </Button>
                </div>

                {scanError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{scanError}</span>
                    <button onClick={() => setScanError(null)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {debouncedQuery && (
                  <div className="mt-3 rounded-lg border border-[--k-border] overflow-hidden">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-6 text-[--k-muted]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (searchHits?.length ?? 0) === 0 ? (
                      <div className="py-6 text-center text-[13px] text-[--k-muted]">
                        Aucun produit pour « {debouncedQuery} »
                      </div>
                    ) : (
                      <ul className="divide-y divide-[--k-border]">
                        {searchHits!.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => setPicked(p)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left row-hover"
                            >
                              {p.imageUrl ? (
                                <img src={getFullImageUrl(p.imageUrl)} alt="" className="h-10 w-10 rounded-md object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[--k-surface-2] text-[--k-muted]">
                                  <ClipboardList className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[14px] font-medium text-[--k-text]">
                                  {p.description || p.reference}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[--k-muted]">
                                  <span className="font-mono">{p.reference}</span>
                                  <span>·</span>
                                  <span>{(p as any).hasSerialNumber ? 'Sérialisé' : 'Quantitatif'}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-[--k-muted]" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {picked && (
            <EntryForm
              product={picked}
              inventoryId={id!}
              locationId={locationId!}
              initialSerial={prefilledSerial}
              source={prefilledSerial ? 'SCAN' : 'SEARCH'}
              onCancel={() => {
                setPicked(null)
                setPrefilledSerial(null)
              }}
              onSaved={() => {
                setPicked(null)
                setPrefilledSerial(null)
                setSearch('')
                invalidateAll()
              }}
            />
          )}
        </div>

        {/* Right column: recent entries */}
        <Card>
          <CardContent>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[--k-text]">Dernières saisies</h3>
              <span className="text-[11px] text-[--k-muted]">{entries?.length || 0}</span>
            </div>
            {!entries || entries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[--k-border] bg-[--k-surface-2]/30 px-3 py-6 text-center text-[12px] text-[--k-muted]">
                Aucune saisie pour cette zone.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-lg border border-[--k-border] px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="font-mono text-[10px] text-[--k-muted] tabular-nums shrink-0">
                      {new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[--k-text]">
                        {e.product.description || e.product.reference}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[--k-muted]">
                        {e.product.hasSerialNumber ? (
                          <span className="font-mono truncate">{e.serialNumber || '— inconnu —'}</span>
                        ) : (
                          <span>{e.quantity}</span>
                        )}
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 font-medium ${STATE_BADGE[e.state]}`}>
                          {STATE_LABEL[e.state]}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(e.id)}
                      className="rounded p-1 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-danger]"
                      title="Supprimer cette saisie"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {unknownOpen && (
        <UnknownEntryModal
          inventoryId={id!}
          locationId={locationId!}
          onClose={() => setUnknownOpen(false)}
          onSaved={() => {
            setUnknownOpen(false)
            invalidateAll()
          }}
        />
      )}

      {finishOpen && (
        <FinishZoneModal
          inventoryId={id!}
          locationId={locationId!}
          zoneName={location.name}
          onClose={() => setFinishOpen(false)}
          onDone={() => {
            setFinishOpen(false)
            navigate(`/inventory/${id}`)
          }}
        />
      )}

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scanner un produit"
        hint="Pointez la caméra vers le QR du produit ou du numéro de série"
      />
    </div>
  )
}

function EntryForm({
  product,
  inventoryId,
  locationId,
  initialSerial,
  source = 'SEARCH',
  onCancel,
  onSaved,
}: {
  product: Product
  inventoryId: string
  locationId: string
  initialSerial?: string | null
  source?: 'SCAN' | 'SEARCH' | 'CATEGORY' | 'UNKNOWN'
  onCancel: () => void
  onSaved: () => void
}) {
  const hasSerial = !!(product as any).hasSerialNumber
  const states: ItemState[] = hasSerial
    ? ['OK', 'TO_CHECK', 'DAMAGED', 'OUT_OF_SERVICE']
    : ['OK', 'TO_CHECK', 'DAMAGED']

  const [quantity, setQuantity] = useState(1)
  const [serial, setSerial] = useState(initialSerial || '')
  const [serialUnknown, setSerialUnknown] = useState(false)
  const [state, setState] = useState<ItemState>('OK')
  const [comment, setComment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dupSerial, setDupSerial] = useState(false)
  const [dupQuantitative, setDupQuantitative] = useState<{ id: string; quantity: number } | null>(null)

  useEffect(() => {
    if (!hasSerial || serialUnknown || !serial.trim()) {
      setDupSerial(false)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await api.get<ApiResponse<{ duplicate: boolean }>>(
          `/inventories/${inventoryId}/check-serial?productId=${product.id}&serial=${encodeURIComponent(serial.trim())}`,
        )
        if (!cancelled) setDupSerial(!!res.data?.data?.duplicate)
      } catch {
        if (!cancelled) setDupSerial(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [hasSerial, serial, serialUnknown, inventoryId, product.id])

  useEffect(() => {
    if (hasSerial) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<ApiResponse<{ id: string; quantity: number } | null>>(
          `/inventories/${inventoryId}/find-quantitative?productId=${product.id}&locationId=${locationId}`,
        )
        if (cancelled) return
        const found = res.data?.data
        if (found) setDupQuantitative({ id: found.id, quantity: found.quantity })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [hasSerial, inventoryId, locationId, product.id])

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api.post<{ success: boolean; data?: { imageUrl: string } }>(
        '/upload/image',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      const url = res.data?.data?.imageUrl
      if (url) {
        const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '')
        setPhotoUrl(url.startsWith('http') ? url : `${apiBase}${url}`)
      }
    } finally {
      setUploading(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/inventories/${inventoryId}/entries`, payload)
    },
    onSuccess: onSaved,
  })

  const replaceMutation = useMutation({
    mutationFn: async (newQty: number) => {
      if (!dupQuantitative) return
      await api.patch(`/inventories/${inventoryId}/entries/${dupQuantitative.id}`, {
        quantity: newQty,
      })
    },
    onSuccess: onSaved,
  })

  const submit = (mode: 'add' | 'replace' = 'add') => {
    if (hasSerial) {
      createMutation.mutate({
        productId: product.id,
        locationId,
        serialNumber: serialUnknown ? null : serial.trim() || null,
        state,
        comment: comment || (serialUnknown ? 'Numéro de série illisible / inconnu' : ''),
        photoUrl,
        source,
      })
      return
    }
    if (dupQuantitative && mode === 'replace') {
      replaceMutation.mutate(quantity)
      return
    }
    if (dupQuantitative && mode === 'add') {
      replaceMutation.mutate(dupQuantitative.quantity + quantity)
      return
    }
    createMutation.mutate({
      productId: product.id,
      locationId,
      quantity,
      state,
      comment,
      photoUrl,
      source,
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          {product.imageUrl ? (
            <img src={getFullImageUrl(product.imageUrl)} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[--k-surface-2] text-[--k-muted]">
              <ClipboardList className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-[--k-text]">
              {product.description || product.reference}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-[--k-muted]">{product.reference}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasSerial ? (
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[--k-text]">
              Numéro de série / numéro interne
            </label>
            <input
              value={serial}
              disabled={serialUnknown}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Ex : DS620-A8X9321"
              className="w-full rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2 text-[14px] font-mono disabled:opacity-50 focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
            />
            <label className="mt-2 flex items-center gap-2 text-[12px] text-[--k-muted]">
              <input
                type="checkbox"
                checked={serialUnknown}
                onChange={(e) => setSerialUnknown(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[--k-border]"
              />
              Numéro non lisible / inconnu
            </label>
            {dupSerial && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[12px] text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Ce numéro de série a déjà été saisi dans cet inventaire.
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[--k-text]">Quantité comptée</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2 text-[16px] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
            />
            {dupQuantitative && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[12px] text-amber-800">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Ce produit est déjà saisi dans cette zone (qté : {dupQuantitative.quantity}).
                </div>
                <div className="mt-1.5 flex gap-2">
                  <Button size="sm" onClick={() => submit('add')}>
                    Ajouter ({dupQuantitative.quantity + quantity})
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => submit('replace')}>
                    Remplacer ({quantity})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium text-[--k-text]">État</label>
          <div className="flex flex-wrap gap-1.5">
            {states.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition ${
                  state === s
                    ? 'bg-[--k-primary] text-white border-[--k-primary]'
                    : 'bg-[--k-surface] text-[--k-text] border-[--k-border] hover:border-[--k-primary]/40'
                }`}
              >
                {STATE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12px] font-medium text-[--k-text]">Commentaire (optionnel)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2 text-[13px] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadPhoto(f)
              e.target.value = ''
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-2 h-3.5 w-3.5" />}
            {photoUrl ? 'Changer photo' : 'Ajouter photo'}
          </Button>
          {photoUrl && (
            <>
              <img src={photoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="text-[11px] text-[--k-muted] hover:text-[--k-danger]"
              >
                Retirer
              </button>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            onClick={() => submit('add')}
            disabled={createMutation.isPending || replaceMutation.isPending || (hasSerial && !serialUnknown && !serial.trim() && !dupSerial)}
          >
            {createMutation.isPending || replaceMutation.isPending ? 'Enregistrement…' : 'Valider la saisie'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UnknownEntryModal({
  inventoryId,
  locationId,
  onClose,
  onSaved,
}: {
  inventoryId: string
  locationId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Câble')
  const [quantity, setQuantity] = useState(1)
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/inventories/${inventoryId}/unknowns`, {
        description: description.trim(),
        category,
        quantity,
        comment: comment.trim() || null,
        locationId,
      })
    },
    onSuccess: onSaved,
  })

  return (
    <Modal isOpen={true} onClose={onClose} title="Produit non trouvé" size="md">
      <div className="space-y-4">
        <Input
          id="desc"
          label="Description"
          required
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : petit câble noir USB-C"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="cat"
            label="Catégorie"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Câble</option>
            <option>Accessoire</option>
            <option>Consommable</option>
            <option>Matériel</option>
            <option>Autre</option>
          </Select>
          <Input
            id="qty"
            type="number"
            label="Quantité"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[--k-text]">Commentaire</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2 text-[13px] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!description.trim() || mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function FinishZoneModal({
  inventoryId,
  locationId,
  zoneName,
  onClose,
  onDone,
}: {
  inventoryId: string
  locationId: string
  zoneName: string
  onClose: () => void
  onDone: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['zone-summary', inventoryId, locationId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ entryCount: number; unknownCount: number; commentCount: number }>>(
        `/inventories/${inventoryId}/zone-summary?locationId=${locationId}`,
      )
      return res.data?.data
    },
  })

  return (
    <Modal isOpen={true} onClose={onClose} title="Terminer la zone" size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-[--k-surface-2] px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">Zone</div>
          <div className="mt-0.5 text-[14px] font-medium text-[--k-text]">{zoneName}</div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-[--k-muted]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Row label="Saisies réalisées" value={data?.entryCount ?? 0} />
            <Row label="Produits non trouvés" value={data?.unknownCount ?? 0} />
            <Row label="Commentaires ajoutés" value={data?.commentCount ?? 0} />
          </div>
        )}
        <p className="text-[11px] text-[--k-muted]">
          Les écarts avec le stock théorique ne sont pas affichés à la saisie. Ils seront calculés ensuite.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Continuer
          </Button>
          <Button onClick={onDone}>Valider la fin</Button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[--k-border] bg-[--k-surface] px-3 py-2 text-[13px]">
      <span className="text-[--k-muted]">{label}</span>
      <span className="font-semibold tabular-nums text-[--k-text]">{value}</span>
    </div>
  )
}
