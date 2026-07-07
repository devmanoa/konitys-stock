import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import api from '../../services/api';
import RichTextEditor from '../ui/RichTextEditor';
import type { Order, OrderItem, Site, ApiResponse } from '../../types';

interface ItemLine {
  itemId: string;
  productName: string;
  productRef: string;
  orderedQty: number;
  receivedQty: number;
  condition: 'NEW' | 'USED';
}

interface ReceiveAllFormProps {
  order: Order;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ReceiveAllForm({ order, onSuccess, onCancel }: ReceiveAllFormProps) {
  const queryClient = useQueryClient();

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Site[]>>('/sites');
      return res.data?.data;
    },
  });

  const storageSites = sites?.filter(s => s.type === 'STORAGE' && s.isActive) || [];

  const pendingItems = (order.items || []).filter(
    (i: OrderItem) => i.receivedQty === null || i.receivedQty === undefined
  );

  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [siteId, setSiteId] = useState(order.destinationSiteId || '');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<ItemLine[]>(
    pendingItems.map((item) => ({
      itemId: item.id,
      productName: item.product?.description || item.product?.reference || 'Produit',
      productRef: item.product?.reference || '',
      orderedQty: item.quantity,
      receivedQty: item.quantity,
      condition: 'NEW' as const,
    }))
  );

  const selectedSite = storageSites.find(s => s.id === siteId);

  const updateLine = (itemId: string, field: 'receivedQty' | 'condition', value: number | string) => {
    setLines(prev => prev.map(l =>
      l.itemId === itemId ? { ...l, [field]: value } : l
    ));
  };

  const totalReceivedQty = lines.reduce((s, l) => s + l.receivedQty, 0);
  const hasQtyMismatch = lines.some(l => l.receivedQty !== l.orderedQty);

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        receivedDate: new Date(receivedDate).toISOString(),
        siteId: siteId || undefined,
        comment: comment || undefined,
        items: lines.map(l => ({
          itemId: l.itemId,
          receivedQty: l.receivedQty,
          condition: l.condition,
        })),
      };
      const res = await api.post(`/orders/${order.id}/receive-all`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['order-audit', order.id] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      onSuccess();
    },
  });

  const canSubmit = receivedDate && siteId && lines.every(l => l.receivedQty > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    receiveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Articles table */}
      <div>
        <h4 className="text-[13px] font-medium text-[--k-text] mb-2">
          Articles à réceptionner ({lines.length})
        </h4>
        <div className="overflow-x-auto border border-[--k-border] rounded-xl">
          <table className="w-full text-[13px] table-zebra">
            <thead className="bg-blue-50/80">
              <tr className="text-left text-xs font-medium text-blue-900">
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-center w-20">Commandé</th>
                <th className="px-3 py-2 w-28">Qté reçue</th>
                <th className="px-3 py-2 w-32">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--k-border]">
              {lines.map((line) => (
                <tr key={line.itemId} className="bg-white">
                  <td className="px-3 py-2">
                    <div className="text-[--k-text] font-medium truncate max-w-[200px]">
                      {line.productName}
                    </div>
                    {line.productRef && (
                      <div className="text-[11px] text-[--k-muted] font-mono">{line.productRef}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-[--k-muted] font-medium">
                    {line.orderedQty}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={line.receivedQty}
                      onChange={(e) => updateLine(line.itemId, 'receivedQty', parseInt(e.target.value) || 0)}
                      className="w-20 rounded border border-[--k-border] bg-[--k-surface] px-2 py-1 text-[13px] text-center font-semibold text-[--k-text] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={line.condition}
                      onChange={(e) => updateLine(line.itemId, 'condition', e.target.value)}
                      className="w-full rounded border border-[--k-border] bg-[--k-surface] px-2 py-1 text-[13px] text-[--k-text] focus:border-[--k-primary] focus:outline-none focus:ring-1 focus:ring-[--k-primary]"
                    >
                      <option value="NEW">Neuf</option>
                      <option value="USED">Occasion</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasQtyMismatch && (
        <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700 border border-amber-200">
          <strong>Attention :</strong> Certaines quantités reçues diffèrent des quantités commandées.
        </div>
      )}

      <Input
        id="receivedDate"
        type="date"
        label="Date de réception *"
        value={receivedDate}
        onChange={(e) => setReceivedDate(e.target.value)}
      />

      <Select
        id="siteId"
        label="Site de destination *"
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
      >
        <option value="">Sélectionner un site</option>
        {storageSites.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>

      <div className="space-y-1">
        <label className="block text-[13px] font-medium text-[--k-text]">
          Commentaire
        </label>
        <RichTextEditor
          content={comment}
          onChange={setComment}
          placeholder="Commentaire optionnel..."
          fetchMentions={() => []}
        />
      </div>

      {receiveMutation.error && (
        <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700 border border-red-200">
          {(receiveMutation.error as any)?.response?.data?.error || 'Erreur lors de la réception'}
        </div>
      )}

      <div className="rounded-xl bg-emerald-50 p-4 text-[13px] border border-emerald-200">
        <p className="font-medium text-emerald-900 mb-2">Cette action va :</p>
        <ul className="list-disc list-inside space-y-1 text-emerald-700">
          <li>
            Réceptionner <strong>{lines.length} article{lines.length > 1 ? 's' : ''}</strong> ({totalReceivedQty} unité{totalReceivedQty > 1 ? 's' : ''})
          </li>
          <li>
            Créer <strong>{lines.length} mouvement{lines.length > 1 ? 's' : ''} d'entrée</strong> vers{' '}
            <strong>{selectedSite?.name || 'le site sélectionné'}</strong>
          </li>
          <li>Mettre à jour les <strong>stocks</strong> en conséquence</li>
          <li>Si tous les articles sont reçus, la commande sera marquée <strong>terminée</strong></li>
        </ul>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={!canSubmit} isLoading={receiveMutation.isPending}>
          Tout réceptionner
        </Button>
      </div>
    </form>
  );
}
