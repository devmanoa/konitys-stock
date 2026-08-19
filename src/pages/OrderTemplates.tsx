import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Truck,
  MapPin,
  Edit2,
  Trash2,
  Search,
  Plus,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import OrderTemplateEditForm from '../components/forms/OrderTemplateEditForm';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import { formatDate as formatDateUtil } from '../utils/date';
import type { OrderTemplate, ApiResponse } from '../types';

// Cette page affiche '—' (tiret cadratin) pour les dates absentes.
const formatDate = (dateStr?: string | null) => formatDateUtil(dateStr, '—');

export default function OrderTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OrderTemplate | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<OrderTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['order-templates'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OrderTemplate[]>>('/order-templates');
      return res.data?.data;
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.put(`/order-templates/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-templates'] });
      setIsRenameOpen(false);
      setSelectedTemplate(null);
      toast.success('Modèle renommé', 'Le modèle a été mis à jour');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de renommer le modèle');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/order-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-templates'] });
      setDeleteConfirm(null);
      toast.success('Modèle supprimé', 'Le modèle a été supprimé');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le modèle');
    },
  });

  const handleRename = (template: OrderTemplate) => {
    setSelectedTemplate(template);
    setRenameName(template.name);
    setIsRenameOpen(true);
  };


  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const filtered = (templates || []).filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(s) ||
      t.supplier?.name?.toLowerCase().includes(s) ||
      t.destinationSite?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Modèles de commande" subtitle="Créez rapidement des commandes pré-remplies">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Ajouter</span>
          <span className="hidden sm:inline">Nouveau modèle</span>
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
        <input
          type="text"
          placeholder="Rechercher un modèle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field !pl-10"
        />
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
          <span className="ml-2 text-[--k-muted]">Chargement...</span>
        </div>
      ) : !filtered.length ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-[--k-muted]" />
          <p className="text-[--k-muted]">
            {search ? 'Aucun modèle trouvé' : 'Aucun modèle enregistré'}
          </p>
          {!search && (
            <p className="mt-1 text-sm text-[--k-muted]">
              Créez un modèle depuis la page détail d'une commande
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((template) => {
              const totalQty = template.items?.reduce((s, i) => s + i.quantity, 0) || 0;
              const estimatedTotal = template.items?.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0) || 0;

              return (
                <div
                  key={template.id}
                  onClick={() => navigate(`/order-templates/${template.id}`)}
                  className="rounded-2xl border border-[--k-border] bg-[--k-surface] p-4 cursor-pointer hover:border-[--k-primary] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[--k-text]">{template.name}</p>
                      <p className="mt-1 text-sm text-[--k-muted] flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {template.supplier?.name}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleRename(template)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(template)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[--k-muted]">Articles :</span>
                      <p className="font-medium text-[--k-text]">{template.items?.length || 0}</p>
                    </div>
                    <div>
                      <span className="text-[--k-muted]">Quantité :</span>
                      <p className="font-medium text-[--k-text]">{totalQty}</p>
                    </div>
                    {template.destinationSite && (
                      <div>
                        <span className="text-[--k-muted]">Destination :</span>
                        <p className="text-[--k-text]">{template.destinationSite.name}</p>
                      </div>
                    )}
                    {estimatedTotal > 0 && (
                      <div>
                        <span className="text-[--k-muted]">Montant HT :</span>
                        <p className="font-medium text-[--k-text]">{formatPrice(estimatedTotal)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03]">
            <div className="flex items-baseline justify-between gap-3 border-b border-[--k-border] px-4 py-2.5">
              <div className="text-lg font-semibold text-[--k-text]">Liste des modèles</div>
              <div className="text-xs text-[--k-muted]">{filtered.length} élément{filtered.length > 1 ? 's' : ''}</div>
            </div>
            <table className="w-full text-[13px] table-zebra">
              <thead className="sticky -top-5 z-10">
                <tr className="border-b border-[--k-border] bg-white">
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">Nom</th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">Fournisseur</th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">Destination</th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">Articles</th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white">Qté totale</th>
                  <th className="px-4 py-1.5 text-right text-xs font-medium bg-white">Montant HT</th>
                  <th className="px-4 py-1.5 text-left text-xs font-medium bg-white">Créé le</th>
                  <th className="px-4 py-1.5 text-center text-xs font-medium bg-white w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((template) => {
                  const totalQty = template.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                  const estimatedTotal = template.items?.reduce((s, i) => s + i.quantity * (i.unitPrice || 0), 0) || 0;

                  return (
                    <tr
                      key={template.id}
                      onClick={() => navigate(`/order-templates/${template.id}`)}
                      className="border-b border-[--k-border] cursor-pointer row-hover transition-colors"
                    >
                      <td className="px-4 py-1.5">
                        <span className="font-medium text-[--k-primary] hover:text-indigo-700 flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {template.name}
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-1 text-[--k-muted]">
                          <Truck className="h-3.5 w-3.5" />
                          {template.supplier?.name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-1 text-[--k-muted]">
                          <MapPin className="h-3.5 w-3.5" />
                          {template.destinationSite?.name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-center text-[--k-muted]">
                        {template.items?.length || 0}
                      </td>
                      <td className="px-4 py-1.5 text-center font-medium text-[--k-text]">
                        {totalQty}
                      </td>
                      <td className="px-4 py-1.5 text-right text-[--k-text]">
                        {estimatedTotal > 0 ? formatPrice(estimatedTotal) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-[--k-muted]">
                        {formatDate(template.createdAt)}
                      </td>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRename(template)}
                            title="Renommer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(template)}
                            title="Supprimer"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Rename Modal */}
      <Modal
        isOpen={isRenameOpen}
        onClose={() => { setIsRenameOpen(false); setSelectedTemplate(null); }}
        title="Renommer le modèle"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nom du modèle"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="ex: Commande mensuelle RS"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setIsRenameOpen(false); setSelectedTemplate(null); }}>
              Annuler
            </Button>
            <Button
              onClick={() => selectedTemplate && renameMutation.mutate({ id: selectedTemplate.id, name: renameName })}
              disabled={!renameName || renameMutation.isPending}
            >
              {renameMutation.isPending ? 'Enregistrement...' : 'Renommer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le modèle{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.name}</span> ?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
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

      {/* Create Template Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nouveau modèle de commande"
        size="xl"
      >
        <OrderTemplateEditForm
          onSuccess={() => {
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ['order-templates'] });
            toast.success('Modèle créé', 'Le modèle a été enregistré');
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}
