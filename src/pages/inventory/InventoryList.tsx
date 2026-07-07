import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardList, ChevronRight, Loader2 } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import api from '../../services/api'
import type { ApiResponse, Site } from '../../types'
import type { Inventory } from './types'

export default function InventoryList() {
  const navigate = useNavigate()
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
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Inventaires" subtitle="Saisies terrain et comparaison avec le stock théorique">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouvel inventaire</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[--k-muted]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data?.length ? (
            <div className="px-6 py-12 text-center">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 text-[--k-muted]" />
              <p className="text-[14px] font-medium text-[--k-text]">Aucun inventaire</p>
              <p className="mt-1 text-[12px] text-[--k-muted]">
                Créez un inventaire pour commencer la saisie terrain.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] table-zebra">
                <thead>
                  <tr className="border-b border-[--k-border] text-left text-xs font-medium uppercase text-[--k-muted]">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3 text-right">Saisies</th>
                    <th className="px-4 py-3 text-right">Non trouvés</th>
                    <th className="px-4 py-3">Démarré le</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--k-border]">
                  {data.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/inventory/${inv.id}`)}
                      className="cursor-pointer row-hover transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-[--k-text]">{inv.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === 'CLOSED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            Clôturé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            En cours
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[--k-muted]">
                        {inv.site?.name || <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {inv._count?.entries ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[--k-muted]">
                        {inv._count?.unknowns ?? 0}
                      </td>
                      <td className="px-4 py-3 text-[--k-muted]">
                        {new Date(inv.startedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-[--k-muted]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreateInventoryModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            qc.invalidateQueries({ queryKey: ['inventories'] })
            navigate(`/inventory/${id}`)
          }}
        />
      )}
    </div>
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
    <Modal isOpen={true} onClose={onClose} title="Nouvel inventaire" size="md">
      <div className="space-y-4">
        <Input
          id="name"
          label="Nom de l'inventaire"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Stock Plérin — Juin 2026"
        />
        <Select
          id="siteId"
          label="Site (optionnel)"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">— Aucun —</option>
          {sites?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <p className="text-[11px] text-[--k-muted]">
          Choisir un site filtre automatiquement les zones proposées au moment de la saisie.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Création…' : 'Créer et commencer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
