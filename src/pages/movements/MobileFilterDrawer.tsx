import { useEffect, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import type { Site } from '../../types'

/**
 * Bottom-sheet drawer for mobile filtering. Pulls the current values from
 * the URL via props, lets the user tweak them locally, then commits all at
 * once when they tap "Appliquer". Closing without applying discards changes.
 *
 * Date presets are committed as ISO yyyy-mm-dd strings so they round-trip
 * with the existing <input type="date"> filters in the parent page.
 */
interface FilterState {
  type: string
  site: string
  condition: string
  startDate: string
  endDate: string
}

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default function MobileFilterDrawer({
  open,
  onClose,
  initial,
  sites,
  onApply,
  onReset,
}: {
  open: boolean
  onClose: () => void
  initial: FilterState
  sites: Site[]
  onApply: (next: FilterState) => void
  onReset: () => void
}) {
  const [draft, setDraft] = useState<FilterState>(initial)

  // Resync the draft each time the drawer reopens, so the user always sees
  // the actual current filter state (not stale local edits).
  useEffect(() => {
    if (open) setDraft(initial)
  }, [open, initial])

  if (!open) return null

  const setDate = (start: string, end: string) =>
    setDraft((d) => ({ ...d, startDate: start, endDate: end }))

  const datePreset = (() => {
    if (!draft.startDate && !draft.endDate) return 'all'
    const t = today()
    if (draft.startDate === t && draft.endDate === t) return 'today'
    if (draft.startDate === daysAgo(7) && draft.endDate === t) return '7d'
    if (draft.startDate === daysAgo(30) && draft.endDate === t) return '30d'
    return 'custom'
  })()

  return (
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full bg-[--k-surface] rounded-t-2xl max-h-[92vh] overflow-y-auto">
        {/* Grab handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-[--k-border]" />
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold">Filtres</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[--k-muted] hover:bg-[--k-surface-2]"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Type */}
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted] mb-2">
              Type
            </h3>
            <div className="flex gap-2">
              <Chip
                active={draft.type === ''}
                onClick={() => setDraft((d) => ({ ...d, type: '' }))}
              >
                Tous
              </Chip>
              <Chip
                active={draft.type === 'IN'}
                onClick={() => setDraft((d) => ({ ...d, type: 'IN' }))}
              >
                Entrée
              </Chip>
              <Chip
                active={draft.type === 'OUT'}
                onClick={() => setDraft((d) => ({ ...d, type: 'OUT' }))}
              >
                Sortie
              </Chip>
              <Chip
                active={draft.type === 'TRANSFER'}
                onClick={() => setDraft((d) => ({ ...d, type: 'TRANSFER' }))}
              >
                Transfert
              </Chip>
            </div>
          </section>

          {/* Condition */}
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted] mb-2">
              État
            </h3>
            <div className="flex gap-2">
              <Chip
                active={draft.condition === ''}
                onClick={() => setDraft((d) => ({ ...d, condition: '' }))}
              >
                Tous
              </Chip>
              <Chip
                active={draft.condition === 'NEW'}
                onClick={() => setDraft((d) => ({ ...d, condition: 'NEW' }))}
              >
                Neuf
              </Chip>
              <Chip
                active={draft.condition === 'USED'}
                onClick={() => setDraft((d) => ({ ...d, condition: 'USED' }))}
              >
                Occasion
              </Chip>
            </div>
          </section>

          {/* Site */}
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted] mb-2">
              Site
            </h3>
            <select
              value={draft.site}
              onChange={(e) => setDraft((d) => ({ ...d, site: e.target.value }))}
              className="input-field"
            >
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </section>

          {/* Date presets */}
          <section className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[--k-muted] mb-2">
              Période
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Chip active={datePreset === 'all'} onClick={() => setDate('', '')}>
                Tout
              </Chip>
              <Chip active={datePreset === 'today'} onClick={() => setDate(today(), today())}>
                Aujourd'hui
              </Chip>
              <Chip active={datePreset === '7d'} onClick={() => setDate(daysAgo(7), today())}>
                7 jours
              </Chip>
              <Chip active={datePreset === '30d'} onClick={() => setDate(daysAgo(30), today())}>
                30 jours
              </Chip>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[--k-muted] mb-1 block">Du</label>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-[11px] text-[--k-muted] mb-1 block">Au</label>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>
          </section>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onReset()
                onClose()
              }}
              className="flex-1 h-12 rounded-xl border border-[--k-border] text-[14px] font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft)
                onClose()
              }}
              className="flex-1 h-12 rounded-xl bg-[--k-primary] text-white text-[14px] font-semibold"
            >
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
        active
          ? 'border-[--k-primary] bg-[--k-primary] text-white'
          : 'border-[--k-border] bg-[--k-surface] text-[--k-text]'
      }`}
    >
      {children}
    </button>
  )
}
