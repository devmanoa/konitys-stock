import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Boxes } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { stripHtml } from '../../components/ui/RichTextDisplay';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import type { AssemblyType, PaginatedResponse, PartType } from '../../types';
import { PART_TYPE_LABEL } from '../../types';
import { PART_TYPE_BADGE_CLASS } from './partTypeBadge';
import Spinner from '../../components/ui/Spinner'

function summarizeAssemblyTypeItems(items: AssemblyType['items']) {
  const list = items || [];
  let total = 0;
  const buckets = new Map<string, number>();
  const byTypeMap = new Map<PartType | 'UNKNOWN', number>();
  for (const it of list) {
    const qty = Number(it.quantity) || 0;
    total += qty;
    const label = it.partCategory?.name || 'Sans catégorie';
    buckets.set(label, (buckets.get(label) || 0) + qty);
    const t = (it.product?.partType || 'UNKNOWN') as PartType | 'UNKNOWN';
    byTypeMap.set(t, (byTypeMap.get(t) || 0) + qty);
  }
  const byCategory = Array.from(buckets.entries())
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty);
  const typeOrder: (PartType | 'UNKNOWN')[] = ['EQUIPMENT', 'PROTECTION', 'ACCESSORY', 'UNKNOWN'];
  const byType = typeOrder
    .filter((t) => byTypeMap.has(t))
    .map((t) => ({
      key: t,
      label: t === 'UNKNOWN' ? 'Non défini' : PART_TYPE_LABEL[t],
      qty: byTypeMap.get(t) || 0,
    }));
  return { total, byCategory, byType };
}

/**
 * Section "Types de bornes" de la page Paramètres : liste + suppression.
 * L'édition/création vit sur sa propre page (/settings/assembly-types/:id/edit).
 */
export default function AssemblyTypesSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [deleteAssemblyTypeConfirm, setDeleteAssemblyTypeConfirm] = useState<AssemblyType | null>(null);

  const { data: assemblyTypesData, isLoading: assemblyTypesLoading } = useQuery({
    queryKey: ['assembly-types'],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<AssemblyType>>('/assembly-types?limit=100');
      return res.data?.data || [];
    },
  });

  const deleteAssemblyTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assembly-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assembly-types'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assemblies'], refetchType: 'all' });
      setDeleteAssemblyTypeConfirm(null);
      toast.success('Type borne supprimé', 'Le type borne a été supprimé');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le type borne');
    },
  });

  return (
    <>
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Types de bornes</span>
          </div>
          <Button size="sm" onClick={() => navigate('/settings/assembly-types/new')}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </div>
        <div className="p-4">
          <p className="text-sm text-[--k-muted] mb-4">
            Les types de bornes représentent les familles de bornes (ex: Borne Classik, Borne Spherik). Une borne peut appartenir à plusieurs types.
          </p>
          {assemblyTypesLoading ? (
            <Spinner size="md" className="py-8" />
          ) : !assemblyTypesData?.length ? (
            <p className="text-[--k-muted] italic py-4">
              Aucun type borne créé
            </p>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 lg:hidden">
                {assemblyTypesData.map((assemblyType) => {
                  const totals = summarizeAssemblyTypeItems(assemblyType.items)
                  return (
                  <div
                    key={assemblyType.id}
                    className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[--k-text]">{assemblyType.name}</h3>
                        {assemblyType.description && (
                          <p className="mt-1 text-sm text-[--k-muted] line-clamp-2">
                            {stripHtml(assemblyType.description)}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-[--k-muted]">
                          Total pièces : <span className="font-semibold text-[--k-text]">{totals.total}</span>
                        </p>
                        {totals.byType.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {totals.byType.map((t) => (
                              <span
                                key={t.key}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  t.key === 'UNKNOWN'
                                    ? 'bg-slate-100 text-slate-600'
                                    : PART_TYPE_BADGE_CLASS[t.key as PartType]
                                }`}
                              >
                                {t.label} : {t.qty}
                              </span>
                            ))}
                          </div>
                        )}
                        {totals.byCategory.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {totals.byCategory.map((c) => (
                              <span
                                key={c.label}
                                className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                              >
                                {c.label} : {c.qty}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/settings/assembly-types/${assemblyType.id}/edit`)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteAssemblyTypeConfirm(assemblyType)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[13px] table-zebra">
                  <thead>
                    <tr className="border-b border-[--k-border] bg-[--k-surface-2]/50">
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Nom</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Description</th>
                      <th className="px-4 py-1.5 text-left text-xs font-medium text-[--k-muted]">Composition</th>
                      <th className="px-4 py-1.5 text-right text-xs font-medium text-[--k-muted]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assemblyTypesData.map((assemblyType) => {
                      const totals = summarizeAssemblyTypeItems(assemblyType.items)
                      return (
                      <tr key={assemblyType.id} className="border-t border-[--k-border] row-hover transition-colors">
                        <td className="px-4 py-1.5 font-medium text-[--k-text]">
                          {assemblyType.name}
                        </td>
                        <td className="px-4 py-1.5 text-[--k-muted]">
                          {assemblyType.description || '-'}
                        </td>
                        <td className="px-4 py-1.5">
                          {totals.total === 0 ? (
                            <span className="text-[--k-muted]">—</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[12px] text-[--k-text]">
                                Total pièces : <span className="font-semibold">{totals.total}</span>
                              </span>
                              {totals.byType.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {totals.byType.map((t) => (
                                    <span
                                      key={t.key}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                        t.key === 'UNKNOWN'
                                          ? 'bg-slate-100 text-slate-600'
                                          : PART_TYPE_BADGE_CLASS[t.key as PartType]
                                      }`}
                                    >
                                      {t.label} : {t.qty}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {totals.byCategory.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {totals.byCategory.map((c) => (
                                    <span
                                      key={c.label}
                                      className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                                    >
                                      {c.label} : {c.qty}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/settings/assembly-types/${assemblyType.id}/edit`)}
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteAssemblyTypeConfirm(assemblyType)}
                              title="Supprimer"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Assembly Type Confirmation */}
      <Modal
        isOpen={!!deleteAssemblyTypeConfirm}
        onClose={() => setDeleteAssemblyTypeConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le type borne{' '}
            <span className="font-semibold text-[--k-text]">{deleteAssemblyTypeConfirm?.name}</span> ?
          </p>
          <p className="text-sm text-red-600">
            Les bornes liées à ce type ne seront plus associées.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteAssemblyTypeConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteAssemblyTypeConfirm && deleteAssemblyTypeMutation.mutate(deleteAssemblyTypeConfirm.id)}
              disabled={deleteAssemblyTypeMutation.isPending}
            >
              {deleteAssemblyTypeMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
