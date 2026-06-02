import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, MapPin, Warehouse, LogOut, X } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SiteForm from '../components/forms/SiteForm';
import LocationsManager from '../components/LocationsManager';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';
import type { Site, ApiResponse } from '../types';

export default function Sites() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<Site | null>(null);

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data;
    },
  });

  // Filtrage côté client pour la recherche
  const filteredSites = sites?.filter((site) =>
    site.name.toLowerCase().includes(search.toLowerCase()) ||
    site.address?.toLowerCase().includes(search.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteConfirm(null);
      toast.success('Site supprimé', 'Le site a été supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur', 'Impossible de supprimer le site');
    },
  });

  const handleCreate = () => {
    setSelectedSite(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (site: Site) => {
    setSelectedSite(site);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSite(undefined);
  };

  const handleSuccess = (isEdit: boolean) => {
    handleModalClose();
    toast.success(
      isEdit ? 'Site modifié' : 'Site créé',
      isEdit ? 'Le site a été mis à jour avec succès' : 'Le site a été créé avec succès'
    );
  };

  const getSiteTypeIcon = (type: string) => {
    return type === 'STORAGE' ? (
      <Warehouse className="h-5 w-5" />
    ) : (
      <LogOut className="h-5 w-5" />
    );
  };

  const getSiteTypeBadge = (type: string) => {
    return type === 'STORAGE' ? (
      <Badge variant="success">Stockage</Badge>
    ) : (
      <Badge variant="info">Sortie</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Sites" subtitle="Gestion des sites de stockage et de sortie" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative min-w-[140px] sm:w-[352px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--k-muted]" />
            <input
              type="text"
              placeholder="Rechercher un site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field !pl-10"
            />
          </div>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch('')}
              className="text-[--k-muted] shrink-0"
            >
              <span className="hidden sm:inline">Réinitialiser</span>
              <X className="h-4 w-4 sm:hidden" />
            </Button>
          )}
        </div>
        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouveau site</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
          <span className="ml-2 text-[--k-muted]">Chargement...</span>
        </div>
      ) : filteredSites?.length === 0 ? (
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] py-12 text-center text-[--k-muted]">
          Aucun site trouvé
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSites?.map((site) => (
            <div key={site.id} className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] p-4 hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${
                    site.type === 'STORAGE'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {getSiteTypeIcon(site.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[--k-text]">{site.name}</h3>
                    <div className="mt-1">
                      {getSiteTypeBadge(site.type)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(site)}
                    title="Modifier"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(site)}
                    title="Supprimer"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {site.address && (
                <div className="mt-3 flex items-start gap-2 text-sm text-[--k-muted]">
                  <MapPin className="h-4 w-4 mt-0.5 text-[--k-muted] flex-shrink-0" />
                  <span className="line-clamp-2">{site.address}</span>
                </div>
              )}

              {!site.isActive && (
                <div className="mt-3 flex items-center justify-end border-t border-[--k-border] pt-3">
                  <Badge variant="default">Inactif</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total count */}
      {filteredSites && filteredSites.length > 0 && (
        <p className="text-sm text-[--k-muted]">
          {filteredSites.length} site(s) trouvé(s)
        </p>
      )}

      {/* Locations manager — defined per site, up to 2 levels */}
      {sites && sites.length > 0 && (
        <LocationsManager sites={sites} />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={selectedSite ? 'Modifier le site' : 'Nouveau site'}
        size="md"
      >
        <SiteForm
          site={selectedSite}
          onSuccess={() => handleSuccess(!!selectedSite)}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[--k-muted]">
            Êtes-vous sûr de vouloir supprimer le site{' '}
            <span className="font-semibold text-[--k-text]">{deleteConfirm?.name}</span> ?
          </p>
          {deleteConfirm?._count?.stocks && deleteConfirm._count.stocks > 0 && (
            <p className="text-sm text-red-600">
              Attention : Ce site contient {deleteConfirm._count.stocks} produit(s) en stock.
              La suppression entraînera la perte de ces données.
            </p>
          )}
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
    </div>
  );
}
