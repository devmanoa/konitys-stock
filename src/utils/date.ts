/**
 * Formatage des dates en locale fr-FR (JJ/MM/AAAA).
 *
 * Les pages historiques utilisaient deux fallbacks différents pour les dates
 * absentes ('-' sur les listes, '—' sur les pages détail) : le paramètre
 * `fallback` permet de conserver le comportement exact de chaque page.
 */
export function formatDate(date: string | null | undefined, fallback = '-'): string {
  if (!date) return fallback;
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Date + heure (JJ/MM/AAAA HH:MM) en locale fr-FR. */
export function formatDateTime(date: string | null | undefined, fallback = '—'): string {
  if (!date) return fallback;
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
