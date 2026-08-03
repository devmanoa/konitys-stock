import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  Package,
  ArrowRightLeft,
  ShoppingCart,
  Boxes,
  FileDown,
  Database,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import api from '../services/api';

interface ImportPreview {
  fileName: string;
  sheets: Record<string, {
    headers: string[];
    rows: number;
    sample: any[];
  }>;
  availableSheets: string[];
}

interface ImportResultData {
  created: number;
  updated?: number;
  errors: string[];
}

interface ImportResult {
  products: ImportResultData;
  suppliers: ImportResultData;
  productSuppliers: ImportResultData;
  sites: ImportResultData;
  stocks: ImportResultData;
  movements: ImportResultData;
  orders: ImportResultData;
}

// Helper functions (outside component for better performance)
const getTotalErrors = (result: ImportResult) => {
  return (
    result.products.errors.length +
    result.suppliers.errors.length +
    result.productSuppliers.errors.length +
    result.sites.errors.length +
    result.stocks.errors.length +
    result.movements.errors.length +
    result.orders.errors.length
  );
};

const getTotalCreated = (result: ImportResult) => {
  return (
    result.products.created +
    result.suppliers.created +
    result.productSuppliers.created +
    result.sites.created +
    result.stocks.created +
    result.movements.created +
    result.orders.created
  );
};

const getTotalUpdated = (result: ImportResult) => {
  return (
    (result.products.updated || 0) +
    (result.suppliers.updated || 0) +
    (result.productSuppliers.updated || 0) +
    (result.stocks.updated || 0)
  );
};

export default function ImportExport() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Sauvegarde / Restauration DB (dump JSON complet)
  const [dbImportFile, setDbImportFile] = useState<File | null>(null);
  const [dbImportConfirmOpen, setDbImportConfirmOpen] = useState(false);
  const [dbImportResult, setDbImportResult] = useState<{
    wipedCounts: Record<string, number>;
    restoredCounts: Record<string, number>;
    totalRestored: number;
  } | null>(null);
  const [dbExportPending, setDbExportPending] = useState(false);

  const handleDbExport = async () => {
    setDbExportPending(true);
    try {
      const res = await api.get('/admin/db-export', { responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `stock-db-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export terminé', 'Le fichier a été téléchargé.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 403 ? 'Réservé aux admins' : 'Erreur',
        status === 403
          ? 'Cette action nécessite le rôle admin Keycloak.'
          : "Impossible d'exporter la base",
      );
    } finally {
      setDbExportPending(false);
    }
  };

  const dbImportMutation = useMutation({
    mutationFn: async () => {
      if (!dbImportFile) throw new Error('Aucun fichier sélectionné');
      const text = await dbImportFile.text();
      const parsed = JSON.parse(text);
      const data = parsed?.data;
      if (!data || typeof data !== 'object') {
        throw new Error('Fichier invalide : champ "data" manquant');
      }
      const res = await api.post<{
        success: boolean;
        data: {
          wipedCounts: Record<string, number>;
          restoredCounts: Record<string, number>;
          totalRestored: number;
        };
      }>('/admin/db-import', { data, confirm: 'WIPE_AND_RESTORE' });
      return res.data.data;
    },
    onSuccess: (result) => {
      setDbImportResult(result);
      setDbImportConfirmOpen(false);
      setDbImportFile(null);
      queryClient.invalidateQueries();
      toast.success(
        'Import terminé',
        `${result.totalRestored} enregistrement(s) restauré(s)`,
      );
    },
    onError: (err: { response?: { status?: number; data?: { error?: string } }; message?: string }) => {
      const status = err.response?.status;
      const msg = err.response?.data?.error || err.message || 'Erreur inconnue';
      toast.error(
        status === 403 ? 'Réservé aux admins' : 'Erreur',
        status === 403 ? 'Cette action nécessite le rôle admin Keycloak.' : msg,
      );
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data as ImportPreview;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data as ImportResult;
    },
    onSuccess: (data) => {
      setImportResult(data);
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      const totalCreated = getTotalCreated(data);
      const totalErrors = getTotalErrors(data);
      if (totalErrors > 0) {
        toast.warning('Import terminé avec avertissements', `${totalCreated} éléments importés, ${totalErrors} erreurs`);
      } else {
        toast.success('Import réussi', `${totalCreated} éléments ont été importés`);
      }
    },
    onError: () => {
      toast.error('Erreur d\'import', 'Impossible de traiter le fichier');
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
    previewMutation.mutate(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const handleDownloadTemplate = async () => {
    const response = await api.get('/import/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_import.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExport = async (endpoint: string, filename: string, format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      const response = await api.get(`/export/${endpoint}?format=${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export réussi', `Fichier ${filename}.${format} téléchargé`);
    } catch {
      toast.error('Erreur d\'export', 'Impossible de générer le fichier');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Import / Export" subtitle="Importez vos données depuis Excel ou exportez vos données actuelles" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Import Section */}
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[--k-border] bg-gradient-to-r from-blue-50/60 to-indigo-50/30 px-4 py-2.5">
            <Upload className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Import Excel</span>
          </div>
          <div className="space-y-4 p-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? 'border-[--k-primary] bg-indigo-50'
                  : 'border-[--k-border]'
              }`}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-[--k-muted] mb-4" />
              <p className="text-[--k-muted] mb-2">
                Glissez-déposez votre fichier Excel ici
              </p>
              <p className="text-sm text-[--k-muted] mb-4">
                ou
              </p>
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-[--k-border] bg-[--k-surface] px-4 py-2 text-sm font-medium text-[--k-text] hover:bg-[--k-surface-2]">
                  Parcourir les fichiers
                </span>
              </label>
              <p className="text-xs text-[--k-muted] mt-4">
                Formats supportés: .xlsx, .xls, .csv (max 10 Mo)
              </p>
            </div>

            {/* Selected file */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-[--k-surface-2] rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[--k-primary]" />
                  <div>
                    <p className="text-sm font-medium text-[--k-text]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-[--k-muted]">
                      {(selectedFile.size / 1024).toFixed(1)} Ko
                    </p>
                  </div>
                </div>
                {previewMutation.isPending && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
                )}
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="space-y-3">
                <h4 className="font-medium text-[--k-text]">Aperçu du fichier</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {preview.availableSheets.map(sheetName => {
                    const sheet = preview.sheets[sheetName];
                    if (!sheet) return null;
                    return (
                      <div key={sheetName} className="p-3 bg-[--k-surface-2] rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[--k-text]">
                            {sheetName}
                          </span>
                          <Badge variant="default">{sheet.rows} lignes</Badge>
                        </div>
                        <p className="text-xs text-[--k-muted] truncate">
                          Colonnes: {sheet.headers.slice(0, 5).join(', ')}
                          {sheet.headers.length > 5 && ` +${sheet.headers.length - 5}`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={handleImport}
                  isLoading={importMutation.isPending}
                  className="w-full"
                >
                  Lancer l'import
                </Button>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="space-y-3">
                <div className={`p-4 rounded-lg ${
                  getTotalErrors(importResult) > 0
                    ? 'bg-yellow-50'
                    : 'bg-green-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getTotalErrors(importResult) > 0 ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    <span className="font-medium text-[--k-text]">
                      Import terminé
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-green-600">
                      {getTotalCreated(importResult)} créé(s)
                    </div>
                    <div className="text-blue-600">
                      {getTotalUpdated(importResult)} mis à jour
                    </div>
                    <div className="text-red-600">
                      {getTotalErrors(importResult)} erreur(s)
                    </div>
                  </div>
                </div>

                {/* Detailed results */}
                <div className="space-y-2 text-sm">
                  <ResultRow label="Produits" data={importResult.products} />
                  <ResultRow label="Fournisseurs" data={importResult.suppliers} />
                  <ResultRow label="Relations Prod-Fourn" data={importResult.productSuppliers} />
                  <ResultRow label="Sites" data={importResult.sites} />
                  <ResultRow label="Stocks" data={importResult.stocks} />
                  <ResultRow label="Mouvements" data={importResult.movements} />
                  <ResultRow label="Commandes" data={importResult.orders} />
                </div>
              </div>
            )}

            {/* Error */}
            {(previewMutation.error || importMutation.error) && (
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">
                {(previewMutation.error as any)?.response?.data?.error ||
                  (importMutation.error as any)?.response?.data?.error ||
                  'Erreur lors du traitement du fichier'}
              </div>
            )}

            {/* Download template */}
            <div className="pt-4 border-t border-[--k-border]">
              <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                <FileDown className="h-4 w-4 mr-2" />
                Télécharger le modèle Excel
              </Button>
              <p className="text-xs text-[--k-muted] text-center mt-2">
                Structure compatible avec le fichier Excel original (SYNTHESE, REF FOURNISSEURS, MVT CLASSIK, COMMANDES CLASSIK)
              </p>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[--k-border] bg-gradient-to-r from-emerald-50/40 to-teal-50/20 px-4 py-2.5">
            <Download className="h-4 w-4 text-[--k-primary]" />
            <span className="text-lg font-semibold text-[--k-text]">Export</span>
          </div>
          <div className="space-y-4 p-4">
            {/* Export All */}
            <div className="p-4 bg-indigo-50 rounded-lg">
              <h4 className="font-medium text-indigo-900 mb-2">
                Export complet
              </h4>
              <p className="text-sm text-indigo-700 mb-3">
                Exportez toutes les données (produits, stocks, mouvements, commandes) dans un fichier Excel multi-feuilles compatible avec l'import
              </p>
              <Button onClick={() => handleExport('all', `export_complet_${new Date().toISOString().split('T')[0]}`)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exporter tout (Excel)
              </Button>
            </div>

            {/* Individual exports */}
            <div className="space-y-3">
              <h4 className="font-medium text-[--k-text]">Exports individuels</h4>

              <ExportCard
                icon={Package}
                title="Produits (Synthèse)"
                description="Produits avec stocks et infos fournisseurs"
                onExportXlsx={() => handleExport('products', 'produits', 'xlsx')}
                onExportCsv={() => handleExport('products', 'produits', 'csv')}
              />

              <ExportCard
                icon={Boxes}
                title="Matrice Stock"
                description="Stock par produit et par site"
                onExportXlsx={() => handleExport('stock-matrix', 'matrice_stock', 'xlsx')}
                onExportCsv={() => handleExport('stock-matrix', 'matrice_stock', 'csv')}
              />

              <ExportCard
                icon={ArrowRightLeft}
                title="Mouvements"
                description="Historique des mouvements de stock"
                onExportXlsx={() => handleExport('movements', 'mouvements', 'xlsx')}
                onExportCsv={() => handleExport('movements', 'mouvements', 'csv')}
              />

              <ExportCard
                icon={ShoppingCart}
                title="Commandes"
                description="Liste des commandes fournisseurs"
                onExportXlsx={() => handleExport('orders', 'commandes', 'xlsx')}
                onExportCsv={() => handleExport('orders', 'commandes', 'csv')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sauvegarde / Restauration base de données (dump JSON complet) */}
      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[--k-border] bg-gradient-to-r from-rose-50/50 to-red-50/20 px-4 py-2.5">
          <Database className="h-4 w-4 text-[--k-primary]" />
          <span className="text-lg font-semibold text-[--k-text]">
            Sauvegarde / Restauration
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[--k-muted]">
            Exporte la base complète en JSON pour la sauvegarder ou la migrer
            vers un autre environnement (ex : DEV → PROD). L'import{' '}
            <b>écrase intégralement</b> la base actuelle.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDbExport}
              disabled={dbExportPending}
              data-perm="stock:db.export"
            >
              {dbExportPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Exporter la base
            </Button>
            <label
              className="inline-flex items-center gap-1.5 rounded-lg border border-[--k-border] bg-[--k-surface] hover:bg-[--k-surface-2] px-3 py-1.5 text-[13px] cursor-pointer"
              data-perm="stock:db.import"
            >
              <Upload className="h-4 w-4" />
              Choisir un fichier à importer…
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f) {
                    setDbImportFile(f);
                    setDbImportConfirmOpen(true);
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <span className="text-xs text-[--k-muted]">
              Réservé aux administrateurs.
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation import DB */}
      <Modal
        isOpen={dbImportConfirmOpen}
        onClose={() => {
          setDbImportConfirmOpen(false);
          setDbImportFile(null);
        }}
        title="Confirmer l'import de la base"
        size="md"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Attention — action destructive</div>
              <div className="text-[12px]">
                Cette action va <b>supprimer toutes les données actuelles</b>{' '}
                de cette base et les remplacer par le contenu du fichier.
                Aucun retour possible.
              </div>
            </div>
          </div>
          {dbImportFile && (
            <div className="text-[13px] text-[--k-muted]">
              Fichier :{' '}
              <span className="font-mono text-[--k-text]">{dbImportFile.name}</span>{' '}
              ({Math.round(dbImportFile.size / 1024)} kB)
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDbImportConfirmOpen(false);
                setDbImportFile(null);
              }}
              disabled={dbImportMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => dbImportMutation.mutate()}
              disabled={!dbImportFile || dbImportMutation.isPending}
            >
              {dbImportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Import en cours…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Écraser et importer
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Résultat import DB */}
      <Modal
        isOpen={!!dbImportResult}
        onClose={() => setDbImportResult(null)}
        title="Import terminé"
        size="md"
      >
        {dbImportResult && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[--k-surface-2]/60 p-3 text-sm">
              <b>{dbImportResult.totalRestored}</b> enregistrement(s) restauré(s)
              au total.
            </div>
            <div className="text-xs font-medium text-[--k-muted]">
              Détail par table
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[--k-border]">
              <table className="w-full text-[12px]">
                <thead className="bg-[--k-surface-2]/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-[--k-muted]">
                      Table
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-[--k-muted]">
                      Vidé
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-[--k-muted]">
                      Importé
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(dbImportResult.restoredCounts).map((t) => {
                    const restored = dbImportResult.restoredCounts[t];
                    const wiped = dbImportResult.wipedCounts[t] || 0;
                    return (
                      <tr key={t} className="border-t border-[--k-border]">
                        <td className="px-2 py-1 font-mono">{t}</td>
                        <td className="px-2 py-1 text-right text-[--k-muted]">
                          {wiped}
                        </td>
                        <td
                          className={`px-2 py-1 text-right tabular-nums ${
                            restored < 0
                              ? 'text-red-700 font-semibold'
                              : restored > 0
                                ? 'text-emerald-700'
                                : 'text-[--k-muted]'
                          }`}
                        >
                          {restored < 0 ? 'échec' : restored}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setDbImportResult(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Helper components
function ResultRow({ label, data }: { label: string; data: ImportResultData }) {
  const hasUpdated = 'updated' in data && data.updated !== undefined;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[--k-muted]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-green-600">+{data.created}</span>
        {hasUpdated && <span className="text-blue-600">~{data.updated}</span>}
        {data.errors.length > 0 && (
          <span className="text-red-600" title={data.errors.join('\n')}>!{data.errors.length}</span>
        )}
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  onExportXlsx,
  onExportCsv,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onExportXlsx: () => void;
  onExportCsv: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-[--k-surface-2] rounded-lg">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-[--k-muted]" />
        <div>
          <p className="text-sm font-medium text-[--k-text]">{title}</p>
          <p className="text-xs text-[--k-muted]">{description}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onExportXlsx}>
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          CSV
        </Button>
      </div>
    </div>
  );
}
