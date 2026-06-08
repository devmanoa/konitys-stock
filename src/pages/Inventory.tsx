import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, ArrowLeft, ClipboardList, MapPin, Search, ChevronRight, Camera,
  PackageX, ImagePlus, Loader2, Trash2, CheckCircle, AlertTriangle, Plus,
} from 'lucide-react'
import api from '../services/api'
import QrScannerModal, { type ParsedQr } from '../components/QrScannerModal'
import type { ApiResponse, Product, Location, Site } from '../types'

type State = 'OK' | 'TO_CHECK' | 'DAMAGED' | 'OUT_OF_SERVICE'

interface Inventory {
  id: string
  name: string
  siteId: string | null
  site?: Site | null
  startedAt: string
  _count?: { entries: number; unknowns: number }
}

interface InventoryEntry {
  id: string
  productId: string
  quantity: number
  serialNumber: string | null
  state: State
  comment: string | null
  photoUrl: string | null
  source: 'SCAN' | 'SEARCH' | 'CATEGORY' | 'UNKNOWN'
  operatorName: string | null
  createdAt: string
  product: {
    id: string
    reference: string
    description: string | null
    imageUrl: string | null
    hasSerialNumber: boolean
  }
  location?: { id: string; name: string } | null
}

const STATE_LABEL: Record<State, string> = {
  OK: 'OK',
  TO_CHECK: 'À contrôler',
  DAMAGED: 'Abîmé',
  OUT_OF_SERVICE: 'Hors service',
}

const STATE_BADGE: Record<State, string> = {
  OK: 'bg-emerald-100 text-emerald-700',
  TO_CHECK: 'bg-amber-100 text-amber-700',
  DAMAGED: 'bg-rose-100 text-rose-700',
  OUT_OF_SERVICE: 'bg-slate-200 text-slate-700',
}

export default function Inventory() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const inventoryId = params.get('inv')
  const locationId = params.get('zone')

  if (!inventoryId) return <InventoryList onPick={(id) => setParams({ inv: id })} onClose={() => navigate('/')} />
  if (!locationId) {
    return (
      <ZonePicker
        inventoryId={inventoryId}
        onPick={(id) => setParams({ inv: inventoryId, zone: id })}
        onBack={() => setParams({})}
      />
    )
  }
  return (
    <ZoneEntry
      inventoryId={inventoryId}
      locationId={locationId}
      onBack={() => setParams({ inv: inventoryId })}
      onClose={() => navigate('/')}
    />
  )
}

// =====================================================================
// 1) List of active inventories
// =====================================================================
function InventoryList({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['inventories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Inventory[]>>('/inventories')
      return res.data?.data || []
    },
  })

  return (
    <Shell title="Inventaires" onClose={onClose}>
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-[14px] font-medium text-white hover:bg-indigo-700 active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        Nouvel inventaire
      </button>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun inventaire"
          subtitle="Créez un inventaire pour commencer la saisie."
        />
      ) : (
        <ul className="space-y-2">
          {data.map((inv) => (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => onPick(inv.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm active:scale-[0.99]"
              >
                <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-slate-900">{inv.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-slate-500">
                    {inv.site?.name && <span>{inv.site.name}</span>}
                    {inv.site?.name && <span>·</span>}
                    <span>{inv._count?.entries ?? 0} saisies</span>
                    {(inv._count?.unknowns ?? 0) > 0 && (
                      <>
                        <span>·</span>
                        <span>{inv._count!.unknowns} non trouvés</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <CreateInventoryModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            qc.invalidateQueries({ queryKey: ['inventories'] })
            onPick(id)
          }}
        />
      )}
    </Shell>
  )
}

function CreateInventoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [siteId, setSiteId] = useState('')

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites')
      return res.data?.data || []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<Inventory>>('/inventories', {
        name: name.trim(),
        siteId: siteId || null,
      })
      return res.data?.data
    },
    onSuccess: (inv) => {
      if (inv?.id) onCreated(inv.id)
    },
  })

  return (
    <ModalShell title="Nouvel inventaire" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-slate-700">Nom</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Stock Plérin — Juin 2026"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-slate-700">Site (optionnel)</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]"
          >
            <option value="">— Aucun —</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Filtre les zones proposées au moment de la saisie.
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-[14px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Création…' : 'Créer et commencer'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// =====================================================================
// 2) Zone picker: hierarchical locations
// =====================================================================
function ZonePicker({
  inventoryId,
  onPick,
  onBack,
}: {
  inventoryId: string
  onPick: (locationId: string) => void
  onBack: () => void
}) {
  const { data: inv } = useQuery({
    queryKey: ['inventory', inventoryId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Inventory>>(`/inventories/${inventoryId}`)
      return res.data?.data
    },
  })

  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations', inv?.siteId],
    queryFn: async () => {
      const q = inv?.siteId ? `?siteId=${inv.siteId}` : ''
      const res = await api.get<ApiResponse<Location[]>>(`/locations${q}`)
      return res.data?.data || []
    },
  })

  const [parentId, setParentId] = useState<string | null>(null)
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

  return (
    <Shell title={inv?.name || 'Inventaire'} subtitle="Choisissez une zone" onBack={onBack}>
      {breadcrumb.length > 0 && (
        <div className="-mt-2 mb-2 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
          <button onClick={() => setParentId(null)} className="hover:underline">Racine</button>
          {breadcrumb.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => setParentId(b.id)} className="hover:underline">{b.name}</button>
            </span>
          ))}
        </div>
      )}
      {isLoading ? (
        <Spinner />
      ) : currentList.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucune sous-zone" subtitle="Sélectionnez la zone courante pour commencer la saisie." />
      ) : (
        <ul className="space-y-2">
          {currentList.map((loc: any) => {
            const hasChildren = locations?.some((l: any) => l.parentId === loc.id)
            return (
              <li key={loc.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => onPick(loc.id)}
                  className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
                >
                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium text-slate-900">{loc.name}</div>
                  </div>
                </button>
                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => setParentId(loc.id)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 text-slate-500 hover:bg-slate-50"
                    title="Explorer les sous-zones"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

// =====================================================================
// 3) Zone entry: search/scan + form + recent
// =====================================================================
function ZoneEntry({
  inventoryId,
  locationId,
  onBack,
  onClose,
}: {
  inventoryId: string
  locationId: string
  onBack: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  const [prefilledSerial, setPrefilledSerial] = useState<string | null>(null)
  const [unknownOpen, setUnknownOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)

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
      // serial
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

  const { data: inv } = useQuery({
    queryKey: ['inventory', inventoryId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Inventory>>(`/inventories/${inventoryId}`)
      return res.data?.data
    },
  })

  const { data: location } = useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Location>>(`/locations/${locationId}`)
      return res.data?.data
    },
  })

  // Latest entries for this zone
  const { data: entries, refetch: refetchEntries } = useQuery({
    queryKey: ['inventory-entries', inventoryId, locationId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<InventoryEntry[]>>(
        `/inventories/${inventoryId}/entries?locationId=${locationId}&limit=15`,
      )
      return res.data?.data || []
    },
  })

  // Product search (debounced)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchHits, isFetching: isSearching } = useQuery({
    queryKey: ['product-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return []
      const res = await api.get<{ data?: Product[] } & ApiResponse<Product[]>>(
        `/products?search=${encodeURIComponent(debouncedQuery)}&limit=10`,
      )
      // products endpoint returns { data: { data: [...] } } depending on shape, normalise.
      const payload: any = res.data
      return (payload?.data?.data || payload?.data || []) as Product[]
    },
    enabled: !!debouncedQuery && !picked,
  })

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/inventories/${inventoryId}/entries/${entryId}`)
    },
    onSuccess: () => {
      refetchEntries()
      qc.invalidateQueries({ queryKey: ['inventory', inventoryId] })
    },
  })

  return (
    <Shell
      title={inv?.name || 'Inventaire'}
      subtitle={location ? `Zone : ${location.name}` : 'Zone'}
      onBack={onBack}
      onClose={onClose}
    >
      {/* Search bar */}
      {!picked && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Scanner ou rechercher un produit…"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-[14px] placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setScanError(null)
                setScannerOpen(true)
              }}
              disabled={scanLoading}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {scanLoading ? 'Chargement…' : 'Scanner'}
            </button>
            <button
              type="button"
              onClick={() => setUnknownOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-800 hover:bg-amber-100"
            >
              <PackageX className="h-4 w-4" />
              Produit non trouvé
            </button>
          </div>

          {scanError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{scanError}</span>
              <button onClick={() => setScanError(null)} className="text-rose-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Search results */}
          {debouncedQuery && (
            <div className="rounded-xl border border-slate-200 bg-white">
              {isSearching ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (searchHits?.length ?? 0) === 0 ? (
                <div className="py-6 text-center text-[13px] text-slate-500">
                  Aucun produit pour "{debouncedQuery}"
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {searchHits!.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(p)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-slate-900">
                            {p.description || p.reference}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono">{p.reference}</span>
                            <span>·</span>
                            <span>{(p as any).hasSerialNumber ? 'Sérialisé' : 'Quantitatif'}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {/* Entry form */}
      {picked && (
        <EntryForm
          product={picked}
          inventoryId={inventoryId}
          locationId={locationId}
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
            refetchEntries()
            qc.invalidateQueries({ queryKey: ['inventory', inventoryId] })
          }}
        />
      )}

      {/* Recent entries */}
      {!picked && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
              Dernières saisies
            </span>
            <span className="text-[12px] text-slate-400">{entries?.length || 0} affichées</span>
          </div>
          {!entries || entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-[13px] text-slate-500">
              Aucune saisie pour cette zone.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-slate-800">
                      {e.product.description || e.product.reference}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                      {e.product.hasSerialNumber ? (
                        <span className="font-mono">{e.serialNumber || '— inconnu —'}</span>
                      ) : (
                        <span>Qté {e.quantity}</span>
                      )}
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATE_BADGE[e.state]}`}>
                        {STATE_LABEL[e.state]}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(e.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    title="Supprimer cette saisie"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bottom action: finish zone */}
      {!picked && (
        <button
          type="button"
          onClick={() => setFinishOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-[14px] font-medium text-white hover:bg-indigo-700"
        >
          <CheckCircle className="h-4 w-4" />
          Terminer la zone
        </button>
      )}

      {/* Unknown product modal */}
      {unknownOpen && (
        <UnknownEntryModal
          inventoryId={inventoryId}
          locationId={locationId}
          onClose={() => setUnknownOpen(false)}
          onSaved={() => {
            setUnknownOpen(false)
            qc.invalidateQueries({ queryKey: ['inventory', inventoryId] })
          }}
        />
      )}

      {/* Finish zone modal */}
      {finishOpen && (
        <FinishZoneModal
          inventoryId={inventoryId}
          locationId={locationId}
          zoneName={location?.name || 'Zone'}
          onClose={() => setFinishOpen(false)}
          onDone={() => {
            setFinishOpen(false)
            onBack()
          }}
        />
      )}

      {/* QR scanner modal */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scanner un produit"
        hint="Pointez la caméra vers le QR du produit ou du numéro de série"
      />
    </Shell>
  )
}

// =====================================================================
// Entry form (quantitative or serial)
// =====================================================================
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
  const states: State[] = hasSerial
    ? ['OK', 'TO_CHECK', 'DAMAGED', 'OUT_OF_SERVICE']
    : ['OK', 'TO_CHECK', 'DAMAGED']

  const [quantity, setQuantity] = useState(1)
  const [serial, setSerial] = useState(initialSerial || '')
  const [serialUnknown, setSerialUnknown] = useState(false)
  const [state, setState] = useState<State>('OK')
  const [comment, setComment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Duplicate warnings
  const [dupSerial, setDupSerial] = useState(false)
  const [dupQuantitative, setDupQuantitative] = useState<{ id: string; quantity: number } | null>(null)

  // Check serial duplicate when typed
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

  // Check quantitative duplicate at mount
  useEffect(() => {
    if (hasSerial) return
    ;(async () => {
      try {
        const res = await api.get<ApiResponse<InventoryEntry[]>>(
          `/inventories/${inventoryId}/entries?locationId=${locationId}&limit=200`,
        )
        const list = res.data?.data || []
        const found = list.find((e) => e.productId === product.id)
        if (found) setDupQuantitative({ id: found.id, quantity: found.quantity })
      } catch {
        // ignore
      }
    })()
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
      // Sum into the existing entry to keep a single line per product/zone.
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
      source: 'SEARCH',
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <ClipboardList className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-slate-900">
            {product.description || product.reference}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono">{product.reference}</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {hasSerial ? (
        <div>
          <label className="mb-1 block text-[12px] font-medium text-slate-700">
            Numéro de série / numéro interne
          </label>
          <input
            value={serial}
            disabled={serialUnknown}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Ex : DS620-A8X9321"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-mono disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={serialUnknown}
              onChange={(e) => setSerialUnknown(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
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
          <label className="mb-1 block text-[12px] font-medium text-slate-700">Quantité comptée</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[16px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {dupQuantitative && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[12px] text-amber-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Ce produit est déjà saisi dans cette zone (qté : {dupQuantitative.quantity}).
              </div>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => submit('add')}
                  className="flex-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
                >
                  Ajouter ({dupQuantitative.quantity + quantity})
                </button>
                <button
                  type="button"
                  onClick={() => submit('replace')}
                  className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                >
                  Remplacer ({quantity})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-[12px] font-medium text-slate-700">État</label>
        <div className="flex flex-wrap gap-1.5">
          {states.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition ${
                state === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {STATE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-slate-700">Commentaire (optionnel)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {photoUrl ? 'Changer photo' : 'Ajouter photo'}
        </button>
        {photoUrl && (
          <>
            <img src={photoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="text-[11px] text-slate-500 hover:text-rose-600"
            >
              Retirer
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => submit('add')}
          disabled={createMutation.isPending || replaceMutation.isPending || (hasSerial && !serialUnknown && !serial.trim() && !dupSerial)}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-[14px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending || replaceMutation.isPending ? 'Enregistrement…' : 'Valider'}
        </button>
      </div>
    </div>
  )
}

// =====================================================================
// Unknown product modal
// =====================================================================
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
    <ModalShell title="Produit non trouvé" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium text-slate-700">Description</label>
          <input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex : petit câble noir USB-C"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-700">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]"
            >
              <option>Câble</option>
              <option>Accessoire</option>
              <option>Consommable</option>
              <option>Matériel</option>
              <option>Autre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-700">Quantité</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px]"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-slate-700">Commentaire</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!description.trim() || mutation.isPending}
            className="flex-1 rounded-xl bg-amber-600 py-2.5 text-[14px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// =====================================================================
// Finish zone modal — neutral recap (no theoretical stock)
// =====================================================================
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
    <ModalShell title="Terminer la zone" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Zone</div>
          <div className="mt-0.5 text-[14px] font-medium text-slate-900">{zoneName}</div>
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-1.5">
            <SummaryRow label="Saisies réalisées" value={data?.entryCount ?? 0} />
            <SummaryRow label="Produits non trouvés" value={data?.unknownCount ?? 0} />
            <SummaryRow label="Commentaires ajoutés" value={data?.commentCount ?? 0} />
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Les écarts avec le stock théorique ne sont pas affichés à la saisie. Ils seront calculés ensuite.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[14px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Continuer
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-[14px] font-medium text-white hover:bg-indigo-700"
          >
            Valider la fin
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// =====================================================================
// Layout helpers
// =====================================================================
function Shell({
  title,
  subtitle,
  children,
  onBack,
  onClose,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onBack?: () => void
  onClose?: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Retour"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Quitter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-6 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-8 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-slate-400" />
      <div className="text-[14px] font-medium text-slate-800">{title}</div>
      {subtitle && <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2 text-[13px]">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  )
}
