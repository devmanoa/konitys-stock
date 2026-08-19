import { useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

export interface ActionsMenuItem {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Clé de permission Konitys, rendue en data-perm sur le bouton. */
  perm?: string;
  /** Classes de couleur du bouton (défaut : texte standard + hover surface). */
  className?: string;
}

/**
 * Menu d'actions générique (bouton ⋮ → dropdown), utilisé dans les tableaux
 * et cartes (Orders, Products). Gère son propre état open/close ; les items
 * conditionnels se filtrent au call-site avant de passer le tableau.
 * stopPropagation/preventDefault sur tous les clics : les lignes parentes
 * sont souvent cliquables (navigate).
 */
export default function ActionsMenu({ items }: { items: ActionsMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="rounded-lg p-1.5 text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-[--k-border] bg-[--k-surface] py-1 shadow-lg">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                data-perm={item.perm}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${item.className || 'text-[--k-text] hover:bg-[--k-surface-2]'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
