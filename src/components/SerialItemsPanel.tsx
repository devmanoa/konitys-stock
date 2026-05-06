import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Hash, Search } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import Pagination from './ui/Pagination';
import { useToast } from './ui/Toast';
import api from '../services/api';
import type { ApiResponse, ProductSerialItem, SerialStatus, ProductCondition, Site } from '../types';

const PAGE_SIZE = 15;

const STATUS_LABELS: Record<SerialStatus, string> = {
  IN_STOCK: 'En stock',
  OUT: 'Sorti',
  IN_REPAIR: 'SAV',
  SCRAPPED: 'Rebuté',
  LOST: 'Perdu',
};

const STATUS_BADGE: Record<SerialStatus, string> = {
  IN_STOCK: 'bg-emerald-100 text-emerald-700',
  OUT: 'bg-gray-100 text-gray-700',
  IN_REPAIR: 'bg-amber-100 text-amber-700',
  SCRAPPED: 'bg-red-100 text-red-700',
  LOST: 'bg-red-100 text-red-700',
};

interface Props {
  productId: string;
}

export default function SerialItemsPanel({ productId }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [conditionFilter, setConditionFilter] = useState<string>('');
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, conditionFilter, siteFilter, search]);

  const [editing, setEditing] = useState<ProductSerialItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProductSerialItem | null>(null);

  const [form, setForm] = useState<{
    serialNumber: string;
    condition: ProductCondition;
    siteId: string;
    status: SerialStatus;
    borneNumber: string;
    comment: string;
  }>({
    serialNumber: '',
    condition: 'NEW',
    siteId: '',
    status: 'IN_STOCK',
    borneNumber: '',
    comment: '',
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['serial-items', productId, statusFilter, conditionFilter, siteFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (conditionFilter) params.set('condition', conditionFilter);
      if (siteFilter) params.set('siteId', siteFilter);
      if (search) params.set('search', search);
      const res = await api.get<ApiResponse<ProductSerialItem[]>>(
        `/products/${productId}/serial-items?${params.toString()}`,
      );
      return res.data?.data || [];
    },
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data || [];
    },
  });

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  // Clamp current page if items shrank below it (e.g. after a deletion or filter change)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['serial-items', productId] });
    queryClient.invalidateQueries({ queryKey: ['product', productId] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/products/${productId}/serial-items`, {
        serialNumber: form.serialNumber || null,
        condition: form.condition,
        siteId: form.siteId || null,
        status: form.status,
        borneNumber: form.borneNumber || null,
        comment: form.comment || null,
      });
    },
    onSuccess: () => {
      invalidate();
      closeModals();
      toast.success('Numéro ajouté', 'L\'exemplaire a été créé');
    },
    onError: () => toast.error('Erreur', 'Impossible de créer l\'exemplaire'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await api.put(`/serial-items/${editing.id}`, {
        serialNumber: form.serialNumber || null,
        condition: form.condition,
        siteId: form.siteId || null,
        status: form.status,
        borneNumber: form.borneNumber || null,
        comment: form.comment || null,
      });
    },
    onSuccess: () => {
      invalidate();
      closeModals();
      toast.success('Mis à jour', 'L\'exemplaire a été modifié');
    },
    onError: () => toast.error('Erreur', 'Impossible de modifier l\'exemplaire'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/serial-items/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setDeleteConfirm(null);
      toast.success('Supprimé', 'L\'exemplaire a été supprimé');
    },
    onError: () => toast.error('Erreur', 'Impossible de supprimer'),
  });

  const closeModals = () => {
    setEditing(null);
    setCreating(false);
    setForm({
      serialNumber: '',
      condition: 'NEW',
      siteId: '',
      status: 'IN_STOCK',
      borneNumber: '',
      comment: '',
    });
  };

  const openCreate = () => {
    setCreating(true);
    setForm({
      serialNumber: '',
      condition: 'NEW',
      siteId: '',
      status: 'IN_STOCK',
      borneNumber: '',
      comment: '',
    });
  };

  const openEdit = (item: ProductSerialItem) => {
    setEditing(item);
    setForm({
      serialNumber: item.serialNumber || '',
      condition: item.condition,
      siteId: item.siteId || '',
      status: item.status,
      borneNumber: item.borneNumber || '',
      comment: item.comment || '',
    });
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
          <input
            type="text"
            placeholder="N° de série, n° borne..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
        <div className="w-36">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="w-32">
          <Select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
            <option value="">Tous états</option>
            <option value="NEW">Neuf</option>
            <option value="USED">Occasion</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">Tous sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[--k-muted]">
          Aucun exemplaire à afficher.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[--k-border]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[--k-surface-2]/50 text-[--k-muted]">
                <th className="px-3 py-2 text-left text-xs font-medium">N° de série</th>
                <th className="px-3 py-2 text-left text-xs font-medium">État</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Site</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Statut</th>
                <th className="px-3 py-2 text-left text-xs font-medium">N° borne</th>
                <th className="px-3 py-2 text-left text-xs font-medium">Entrée</th>
                <th className="px-3 py-2 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((it) => (
                <tr key={it.id} className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30">
                  <td className="px-3 py-1.5 font-mono">
                    {it.serialNumber ? (
                      <span className="text-[--k-text]">{it.serialNumber}</span>
                    ) : (
                      <span className="text-amber-600 italic flex items-center gap-1">
                        <Hash className="h-3 w-3" /> à compléter
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[--k-muted]">
                    {it.condition === 'NEW' ? 'Neuf' : 'Occasion'}
                  </td>
                  <td className="px-3 py-1.5 text-[--k-muted]">{it.site?.name || '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[it.status]}`}>
                      {STATUS_LABELS[it.status]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[--k-muted] truncate max-w-[160px]">
                    {it.borneNumber || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-[--k-muted] tabular-nums">
                    {new Date(it.enteredAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(it)} title="Modifier">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(it)}
                        title="Supprimer"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-[--k-muted]">
          <span>
            {Math.min((page - 1) * PAGE_SIZE + 1, items.length)}–
            {Math.min(page * PAGE_SIZE, items.length)} sur {items.length}
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal create/edit */}
      <Modal
        isOpen={creating || !!editing}
        onClose={closeModals}
        title={editing ? `Modifier ${editing.serialNumber || 'l\'exemplaire'}` : 'Nouvel exemplaire'}
        size="md"
      >
        <div className="space-y-3">
          <Input
            label="Numéro de série"
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            placeholder="Laisser vide pour compléter plus tard"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-[--k-text] mb-1">État</label>
              <Select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as ProductCondition })}
              >
                <option value="NEW">Neuf</option>
                <option value="USED">Occasion</option>
              </Select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[--k-text] mb-1">Statut</label>
              <Select
                value={form.status}
                onChange={(e) => {
                  const next = e.target.value as SerialStatus
                  setForm((prev) => ({
                    ...prev,
                    status: next,
                    // Clear borne number when leaving OUT status — the field
                    // is hidden in any other state and shouldn't persist a
                    // stale value silently.
                    borneNumber: next === 'OUT' ? prev.borneNumber : '',
                    // Same for siteId: an OUT item is no longer at any site.
                    siteId: next === 'OUT' ? '' : prev.siteId,
                  }))
                }}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
          </div>
          {form.status !== 'OUT' && (
            <div>
              <label className="block text-[13px] font-medium text-[--k-text] mb-1">Site</label>
              <Select
                value={form.siteId}
                onChange={(e) => setForm({ ...form, siteId: e.target.value })}
              >
                <option value="">— Aucun —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          )}
          {form.status === 'OUT' && (
            <Input
              label="N° borne"
              value={form.borneNumber}
              onChange={(e) => setForm({ ...form, borneNumber: e.target.value })}
              placeholder="N° de la borne installée"
            />
          )}
          <div>
            <label className="block text-[13px] font-medium text-[--k-text] mb-1">Commentaire</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              rows={2}
              className="input-field"
              style={{ height: 'auto', padding: '0.5rem 0.75rem' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModals}>Annuler</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Enregistrement...'
                : editing ? 'Modifier' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Supprimer l'exemplaire{' '}
            <span className="font-semibold text-[--k-text]">
              {deleteConfirm?.serialNumber || '(sans n°)'}
            </span> ?
          </p>
          <p className="text-xs text-[--k-muted]">
            Le stock agrégé ne sera pas modifié — utilisez plutôt un mouvement de sortie pour décrémenter le stock.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
