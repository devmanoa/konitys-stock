import { useEffect, useRef, type RefObject } from 'react';

/**
 * Appelle `handler` quand un mousedown a lieu en dehors de l'élément (ou des
 * éléments) référencé(s). Accepte un ref unique ou un tableau de refs (utile
 * quand le dropdown est rendu dans un portal, séparé de son déclencheur).
 *
 * - N'attache l'écouteur que si `enabled` est vrai (par défaut : toujours).
 * - Les refs et le handler sont lus au moment de l'événement (pas de closure
 *   périmée), les appelants peuvent donc passer des valeurs inline.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  handler: () => void,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!enabled) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const list = Array.isArray(refsRef.current) ? refsRef.current : [refsRef.current];
      const elements = list
        .map((r) => r.current)
        .filter((el): el is HTMLElement => el !== null);
      if (elements.length === 0) return;
      if (elements.some((el) => el.contains(target))) return;
      handlerRef.current();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [enabled]);
}
