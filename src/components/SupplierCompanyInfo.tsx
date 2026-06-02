import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import api from '../services/api'
import type { ApiResponse, Supplier } from '../types'

interface Props {
  supplier: Supplier
}

function formatSiret(value?: string | null) {
  if (!value) return null
  const clean = value.replace(/\D/g, '')
  if (clean.length === 14) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`
  }
  return value
}

function statusBadge(status?: string | null) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
        <AlertCircle className="h-3 w-3" />
        Inconnu
      </span>
    )
  }
  if (status === 'A') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Actif
      </span>
    )
  }
  if (status === 'C') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
        <XCircle className="h-3 w-3" />
        Cessé / liquidation
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <AlertCircle className="h-3 w-3" />
      {status}
    </span>
  )
}

export default function SupplierCompanyInfo({ supplier }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<Supplier>>(
        `/suppliers/${supplier.id}/refresh-company-info`,
        supplier.siret ? {} : { siret: '' },
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Infos entreprise rafraîchies')
    },
    onError: (err: any) => {
      toast.error(
        'Erreur',
        err?.response?.data?.error || 'Impossible de rafraîchir les infos',
      )
    },
  })

  // Don't render anything when no SIREN/SIRET is set — the user hasn't asked
  // for this info yet, so the empty card would just add visual noise.
  if (!supplier.siret && !supplier.siren && !supplier.legalName) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Infos entreprise
        </CardTitle>
        {supplier.siret && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="Rafraîchir depuis la base SIRENE"
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
            />
            Rafraîchir
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {supplier.legalName && (
            <div className="col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
                Raison sociale
              </dt>
              <dd className="mt-0.5 font-medium text-[--k-text]">{supplier.legalName}</dd>
            </div>
          )}

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
              SIRET
            </dt>
            <dd className="mt-0.5 font-mono text-[12px] text-[--k-text]">
              {formatSiret(supplier.siret) || '—'}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
              SIREN
            </dt>
            <dd className="mt-0.5 font-mono text-[12px] text-[--k-text]">
              {formatSiret(supplier.siren) || '—'}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
              Statut
            </dt>
            <dd className="mt-0.5">{statusBadge(supplier.legalStatus)}</dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
              Année de création
            </dt>
            <dd className="mt-0.5 text-[--k-text]">
              {supplier.creationYear ?? '—'}
            </dd>
          </div>

          {supplier.naf && (
            <div className="col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[--k-muted]">
                Activité (NAF)
              </dt>
              <dd className="mt-0.5 text-[--k-text]">
                <span className="font-mono text-[12px] bg-[--k-surface-2] rounded px-1.5 py-0.5 mr-2">
                  {supplier.naf}
                </span>
                {supplier.nafLabel}
              </dd>
            </div>
          )}
        </dl>
        {supplier.companyInfoUpdatedAt && (
          <p className="mt-4 text-[11px] text-[--k-muted]">
            Mis à jour le{' '}
            {new Date(supplier.companyInfoUpdatedAt).toLocaleDateString('fr-FR')} ·{' '}
            Source :{' '}
            <a
              href="https://recherche-entreprises.api.gouv.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--k-primary] hover:underline"
            >
              recherche-entreprises.api.gouv.fr
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
