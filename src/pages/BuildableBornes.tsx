import { Fragment, useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Factory, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft, Package } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { PageHeader } from '../components/PageHeader';
import api from '../services/api';
import type { ApiResponse, BuildableBorne, BuildableComponent } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return '/default-product.svg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
  return url;
};

type SectionGroup = { section: string; components: BuildableComponent[] };

function groupBySection(components: BuildableComponent[]): SectionGroup[] {
  const map = new Map<string, BuildableComponent[]>();
  for (const c of components) {
    const key = c.section || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries()).map(([section, comps]) => ({ section, components: comps }));
}

function BorneCard({ borne, onSelect }: { borne: BuildableBorne; onSelect: () => void }) {
  const missing = borne.components.filter((c) => c.currentStock < c.required);
  const canBuild = borne.maxBuildable > 0;

  return (
    <button
      onClick={onSelect}
      className="group text-left w-full rounded-2xl border border-[--k-border] bg-white p-5 shadow-sm shadow-black/[0.03] transition hover:border-[--k-primary] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {borne.imageUrl ? (
            <img
              src={getFullImageUrl(borne.imageUrl)}
              alt={borne.name}
              className="h-12 w-12 rounded-lg object-cover bg-white"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[--k-primary-2] text-[--k-primary]">
              <Factory className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-[--k-text] truncate">{borne.name}</h3>
            {borne.description && (
              <p className="text-xs text-[--k-muted] truncate">{borne.description}</p>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-[--k-muted] transition group-hover:text-[--k-primary]" />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span
          className={`text-4xl font-bold ${
            canBuild ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {borne.maxBuildable}
        </span>
        <span className="pb-1 text-sm text-[--k-muted]">constructibles</span>
      </div>

      {!canBuild && missing.length > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-orange-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {missing.length} pièce{missing.length > 1 ? 's' : ''} manquante
            {missing.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
      {canBuild && missing.length === 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Tous les composants disponibles</span>
        </div>
      )}
    </button>
  );
}

function BorneDetail({ borne, onBack }: { borne: BuildableBorne; onBack: () => void }) {
  const [target, setTarget] = useState<number>(Math.max(borne.maxBuildable, 0));

  useEffect(() => {
    setTarget(Math.max(borne.maxBuildable, 0));
  }, [borne.id, borne.maxBuildable]);

  const groups = useMemo(() => groupBySection(borne.components), [borne.components]);

  const missingParts = borne.components
    .map((c) => ({ ...c, remaining: c.currentStock - target * c.required }))
    .filter((c) => c.remaining < 0)
    .sort((a, b) => a.remaining - b.remaining);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
        <h2 className="text-xl font-bold text-[--k-text]">
          <span className={borne.maxBuildable > 0 ? 'text-green-600' : 'text-red-600'}>
            {borne.maxBuildable}
          </span>{' '}
          {borne.name}
          {borne.maxBuildable === 1 ? ' constructible' : ' constructibles'}
        </h2>
      </div>

      <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[--k-surface-2]/50 text-[--k-muted]">
                <th className="px-4 py-2 text-left text-xs font-medium">Composant</th>
                <th className="px-4 py-2 text-center text-xs font-medium">Qté nécessaire / borne</th>
                <th className="px-4 py-2 text-center text-xs font-medium">Stock actuel</th>
                <th className="px-4 py-2 text-right text-xs font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <span>Qté restante pour</span>
                    <div className="w-20">
                      <Input
                        type="number"
                        min="0"
                        value={target}
                        onChange={(e) => setTarget(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, gi) => (
                <Fragment key={`group-${gi}`}>
                  {group.section && (
                    <tr className="bg-[--k-surface-2]/30">
                      <td colSpan={4} className="px-4 py-2 font-semibold text-[--k-text]">
                        {group.section}
                      </td>
                    </tr>
                  )}
                  {group.components.map((c) => {
                    const remaining = c.currentStock - target * c.required;
                    const stockOk = c.currentStock >= target * c.required;
                    const stockPartial = c.currentStock >= c.required && !stockOk;
                    const stockColor = stockOk
                      ? 'text-green-600'
                      : stockPartial
                      ? 'text-orange-600'
                      : 'text-red-600';
                    return (
                      <tr
                        key={c.id}
                        className="border-t border-[--k-border] hover:bg-[--k-surface-2]/30 transition-colors"
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-[--k-surface-2] flex items-center justify-center overflow-hidden">
                              {c.product.imageUrl ? (
                                <img
                                  src={getFullImageUrl(c.product.imageUrl)}
                                  alt={c.product.reference}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-[--k-muted]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-[--k-text]">
                                {c.product.description || c.product.reference}
                              </div>
                              {c.product.description && (
                                <div className="text-xs text-[--k-muted] truncate">
                                  {c.product.reference}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center text-[--k-text]">{c.required}</td>
                        <td className={`px-4 py-2 text-center font-semibold ${stockColor}`}>
                          {c.currentStock}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold ${
                            remaining >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {remaining > 0 ? `+${remaining}` : remaining}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missingParts.length > 0 && (
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] overflow-hidden">
          <div className="border-b border-[--k-border] px-4 py-2.5">
            <div className="flex items-center gap-2 text-lg font-semibold text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Pièces manquantes pour en fabriquer {target}
            </div>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {missingParts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm"
                >
                  <span className="text-[--k-text]">
                    {p.product.reference}
                    {p.product.description ? ` — ${p.product.description}` : ''}
                  </span>
                  <span className="font-semibold text-red-600">{p.remaining}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuildableBornes() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['buildable-bornes'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BuildableBorne[]>>('/assembly-types/buildable');
      return res.data;
    },
  });

  const bornes = data?.data || [];
  const selected = selectedId ? bornes.find((b) => b.id === selectedId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[--k-primary] border-t-transparent" />
      </div>
    );
  }

  if (selected) {
    return <BorneDetail borne={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bornes constructibles"
        subtitle="Nombre de bornes constructibles en fonction du stock actuel"
      />

      {bornes.length === 0 ? (
        <div className="rounded-2xl border border-[--k-border] bg-white shadow-sm shadow-black/[0.03] py-12 text-center">
          <Factory className="mx-auto h-12 w-12 text-[--k-muted]" />
          <p className="mt-2 text-[--k-muted]">
            Aucune borne définie. Commencez par créer des bornes avec leurs composants dans la page "Nomenclatures de bornes".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bornes.map((borne) => (
            <BorneCard key={borne.id} borne={borne} onSelect={() => setSelectedId(borne.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
