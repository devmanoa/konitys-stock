// Format a stock breakdown as "0", "3 (3 neufs)", "5 (5 occas)", or
// "4 (2 neufs - 2 occas)" — with proper singular/plural agreement.
export function formatStockBreakdown(quantityNew: number, quantityUsed: number): string {
  const total = quantityNew + quantityUsed;
  if (total === 0) return '0';

  const parts: string[] = [];
  if (quantityNew > 0) {
    parts.push(`${quantityNew} ${quantityNew > 1 ? 'neufs' : 'neuf'}`);
  }
  if (quantityUsed > 0) {
    parts.push(`${quantityUsed} occas`);
  }
  return `${total} (${parts.join(' - ')})`;
}
