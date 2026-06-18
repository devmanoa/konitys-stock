import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Search, Camera, PackageX, Loader2, CheckCircle2,
} from 'lucide-react'
import publicApi from '../../../services/publicApi'
import MobileShell from './MobileShell'
import QrScannerModal, { type ParsedQr } from '../../../components/QrScannerModal'
import { getFullImageUrl } from '../../../utils/imageUrl'

interface Product {
  id: string
  reference: string
  description: string | null
  imageUrl: string | null
  hasSerialNumber: boolean
}

export default function MobileInventoryZone() {
  const { linkId, locationId } = useParams<{ linkId: string; locationId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [serial, setSerial] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [unknownOpen, setUnknownOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const searchQ = useQuery({
    queryKey: ['m-search', linkId, debounced],
    queryFn: async () => {
      if (debounced.length < 2) return []
      const res = await publicApi.get<{ success: boolean; data: Product[] }>(
        `inventory/${linkId}/products?q=${encodeURIComponent(debounced)}`,
      )
      return res.data.data
    },
    enabled: !picked && debounced.length >= 2,
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const createEntryM = useMutation({
    mutationFn: async () => {
      if (!picked) return
      await publicApi.post(`inventory/${linkId}/entries`, {
        productId: picked.id,
        locationId,
        quantity: picked.hasSerialNumber ? 1 : quantity,
        serialNumber: picked.hasSerialNumber ? (serial.trim() || null) : null,
        state: 'OK',
        source: 'SEARCH',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m-recent', linkId] })
      showToast(`+ ${picked!.reference}`)
      setPicked(null)
      setQuantity(1)
      setSerial('')
      setSearch('')
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || "Erreur lors de l'enregistrement")
    },
  })

  const handleScan = async (parsed: ParsedQr) => {
    setScannerOpen(false)
    if (parsed.kind === 'unknown') {
      alert(`QR non reconnu : ${parsed.raw.slice(0, 60)}`)
      return
    }
    try {
      if (parsed.kind === 'product') {
        const res = await publicApi.get<{ success: boolean; data: Product }>(
          `inventory/${linkId}/products/${parsed.id}`,
        )
        if (res.data.data) {
          setPicked(res.data.data)
          setSerial('')
        }
      }
      // Note: serial-item QRs are not yet supported on the public route
      // because that endpoint doesn't exist in /api/public. The scanner
      // recognizes 'serial' but we just show a fallback.
      else {
        alert("QR de numéro de série non encore supporté sur l'interface mobile. Tapez la référence à la place.")
      }
    } catch {
      alert('Produit introuvable.')
    }
  }

  return (
    <MobileShell
      title="Saisie"
      subtitle={picked ? `Produit : ${picked.reference}` : 'Recherchez un produit ou scannez'}
    >
      <button
        type="button"
        onClick={() => navigate(`/m/${linkId}`)}
        className="mb-3 inline-flex items-center text-[12px] text-[--k-muted]"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
        Changer de zone
      </button>

      {!picked && (
        <>
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--k-muted]" />
            <input
              type="text"
              inputMode="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Référence ou nom"
              className="w-full h-12 rounded-xl border border-[--k-border] bg-[--k-surface] pl-10 pr-3 text-[15px]"
            />
          </div>

          {/* Scan + unknown buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-12 rounded-xl bg-[--k-primary] text-white text-[14px] font-medium flex items-center justify-center gap-2"
            >
              <Camera className="h-5 w-5" />
              Scanner
            </button>
            <button
              type="button"
              onClick={() => setUnknownOpen(true)}
              className="h-12 rounded-xl border border-[--k-border] bg-[--k-surface] text-[14px] font-medium flex items-center justify-center gap-2"
            >
              <PackageX className="h-5 w-5" />
              Non trouvé
            </button>
          </div>

          {/* Search results */}
          {debounced.length >= 2 && (
            <div className="space-y-2">
              {searchQ.isFetching && (
                <div className="flex items-center justify-center py-3 text-[--k-muted]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {!searchQ.isFetching && (searchQ.data || []).length === 0 && (
                <p className="text-[12px] text-[--k-muted] text-center py-2">
                  Aucun produit trouvé.
                </p>
              )}
              {(searchQ.data || []).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPicked(p)}
                  className="w-full flex items-center gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] px-3 py-2.5 text-left"
                >
                  {p.imageUrl ? (
                    <img
                      src={getFullImageUrl(p.imageUrl)}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-[--k-surface-2]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">
                      {p.description || p.reference}
                    </div>
                    <div className="font-mono text-[11px] text-[--k-muted]">{p.reference}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {picked && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[--k-border] bg-[--k-surface] p-3 flex gap-3">
            {picked.imageUrl ? (
              <img
                src={getFullImageUrl(picked.imageUrl)}
                alt=""
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded bg-[--k-surface-2]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium leading-tight">
                {picked.description || picked.reference}
              </div>
              <div className="font-mono text-[11px] text-[--k-muted] mt-0.5">{picked.reference}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPicked(null)
                setQuantity(1)
                setSerial('')
              }}
              className="text-[12px] text-[--k-muted]"
            >
              Changer
            </button>
          </div>

          {picked.hasSerialNumber ? (
            <div>
              <label className="block text-[12px] font-medium text-[--k-muted] mb-1">
                N° de série
              </label>
              <input
                type="text"
                inputMode="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Scannez ou saisissez"
                className="w-full h-12 rounded-xl border border-[--k-border] bg-[--k-surface] px-3 text-[15px]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[12px] font-medium text-[--k-muted] mb-1">
                Quantité
              </label>
              <div className="flex items-stretch rounded-xl border border-[--k-border] bg-[--k-surface] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-14 text-[20px] font-semibold"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-[18px] font-semibold border-x border-[--k-border]"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-14 text-[20px] font-semibold"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => createEntryM.mutate()}
            disabled={createEntryM.isPending}
            className="w-full h-12 rounded-xl bg-[--k-primary] text-white text-[15px] font-semibold disabled:opacity-50"
          >
            {createEntryM.isPending ? 'Enregistrement…' : 'Enregistrer la saisie'}
          </button>
        </div>
      )}

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {unknownOpen && (
        <UnknownModal
          linkId={linkId!}
          locationId={locationId!}
          onClose={() => setUnknownOpen(false)}
          onSuccess={() => {
            setUnknownOpen(false)
            qc.invalidateQueries({ queryKey: ['m-recent', linkId] })
            showToast('Produit non trouvé enregistré')
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 inset-x-4 z-30 rounded-xl bg-emerald-600 text-white px-4 py-3 shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-[14px]">{toast}</span>
        </div>
      )}
    </MobileShell>
  )
}

function UnknownModal({
  linkId,
  locationId,
  onClose,
  onSuccess,
}: {
  linkId: string
  locationId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await publicApi.post(`inventory/${linkId}/unknowns`, {
        locationId,
        description: description.trim(),
        category: category || null,
        quantity,
      })
      onSuccess()
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur lors de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-[--k-surface] sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
        <h2 className="text-[16px] font-semibold">Produit non trouvé</h2>
        <p className="text-[12px] text-[--k-muted]">
          Décrivez ce que vous voyez sur le terrain.
        </p>
        <input
          type="text"
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (obligatoire)"
          className="w-full h-12 rounded-xl border border-[--k-border] bg-[--k-bg] px-3 text-[15px]"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Catégorie (Câble, Accessoire…)"
          className="w-full h-11 rounded-xl border border-[--k-border] bg-[--k-bg] px-3 text-[14px]"
        />
        <div>
          <label className="block text-[12px] font-medium text-[--k-muted] mb-1">Quantité</label>
          <div className="flex items-stretch rounded-xl border border-[--k-border] bg-[--k-bg] overflow-hidden">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-12 text-[18px] font-semibold">−</button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 text-center text-[16px] font-semibold border-x border-[--k-border]"
            />
            <button onClick={() => setQuantity((q) => q + 1)} className="w-12 text-[18px] font-semibold">+</button>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[--k-border] text-[14px] font-medium"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!description.trim() || submitting}
            className="flex-1 h-11 rounded-xl bg-[--k-primary] text-white text-[14px] font-semibold disabled:opacity-50"
          >
            {submitting ? 'Envoi…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
