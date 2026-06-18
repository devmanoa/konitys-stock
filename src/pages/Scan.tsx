import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, X, Loader2 } from 'lucide-react'
import api from '../services/api'
import QrScannerModal, { type ParsedQr } from '../components/QrScannerModal'
import type { ApiResponse } from '../types'

/**
 * Mobile-first scanner for stock movements.
 *
 *  1. User picks an action (IN / OUT / TRANSFER).
 *  2. QrScannerModal opens, reads the QR.
 *  3. The QR is expected to encode a URL like
 *     https://<stocks-app>/products/<id> or .../serial/<id>.
 *  4. On success, we redirect to /movements with prefilled query params.
 */

type Action = 'IN' | 'OUT' | 'TRANSFER'

const ACTIONS: { key: Action; label: string; description: string; color: string; Icon: typeof ArrowDownCircle }[] = [
  {
    key: 'IN',
    label: 'Entrée de stock',
    description: "Réception d'un produit",
    color: 'from-emerald-500 to-emerald-600',
    Icon: ArrowDownCircle,
  },
  {
    key: 'OUT',
    label: 'Sortie de stock',
    description: 'Utilisation, vente, casse',
    color: 'from-rose-500 to-rose-600',
    Icon: ArrowUpCircle,
  },
  {
    key: 'TRANSFER',
    label: 'Transfert de stock',
    description: 'Entre deux sites',
    color: 'from-indigo-500 to-blue-600',
    Icon: ArrowLeftRight,
  },
]

export default function Scan() {
  const navigate = useNavigate()
  const [action, setAction] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const handleScan = async (parsed: ParsedQr) => {
    if (!action) return
    if (parsed.kind === 'unknown') {
      setError(`QR non reconnu : ${parsed.raw.slice(0, 60)}`)
      setAction(null)
      return
    }
    let productId = parsed.kind === 'product' ? parsed.id : null
    // For a serial QR, resolve the underlying product so MovementForm gets
    // a preselectedProductId — Movements.tsx ignores scanSerialId alone.
    if (parsed.kind === 'serial') {
      setResolving(true)
      try {
        const res = await api.get<ApiResponse<{ productId: string }>>(
          `/serial-items/${parsed.id}`,
        )
        productId = res.data?.data?.productId ?? null
        if (!productId) {
          setError("Numéro de série introuvable.")
          setAction(null)
          return
        }
      } catch {
        setError("Erreur lors de la récupération du numéro de série.")
        setAction(null)
        return
      } finally {
        setResolving(false)
      }
    }
    if (!productId) {
      setError(`QR non reconnu : ${parsed.raw.slice(0, 60)}`)
      setAction(null)
      return
    }
    const params = new URLSearchParams({
      scanAction: action,
      scanProductId: productId,
      ...(parsed.kind === 'serial' ? { scanSerialId: parsed.id } : {}),
    })
    const target = `/movements?${params.toString()}`
    console.log('[scan] resolved', { action, kind: parsed.kind, productId, target })
    navigate(target)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Scan</h1>
            <p className="text-xs text-slate-500">Mouvements de stock par QR code</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/movements')}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Quitter"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        )}

        <p className="text-[13px] text-slate-600">Choisissez l'opération à effectuer :</p>
        {ACTIONS.map(({ key, label, description, color, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setError(null)
              setAction(key)
            }}
            className={`w-full rounded-2xl bg-gradient-to-br ${color} p-5 text-left text-white shadow-md transition active:scale-[0.98]`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold">{label}</div>
                <div className="text-[12px] opacity-90">{description}</div>
              </div>
            </div>
          </button>
        ))}

        <QrScannerModal
          isOpen={!!action}
          onClose={() => setAction(null)}
          onScan={handleScan}
          title={action ? ACTIONS.find((a) => a.key === action)!.label : 'Scanner'}
          hint="Pointez la caméra vers le QR code du produit ou du numéro de série"
        />

        {resolving && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40">
            <div className="rounded-xl bg-white px-4 py-3 shadow-lg flex items-center gap-2 text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">Résolution du QR…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
