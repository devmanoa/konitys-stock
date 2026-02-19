import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { KnownUser } from '../../types';

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--k-primary] text-[10px] font-bold text-white">
      {initials}
    </div>
  );
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: KnownUser[];
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.authorUsername, label: item.authorName });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="w-64 rounded-xl border border-[--k-border] bg-[--k-surface] shadow-lg overflow-hidden">
        {items.map((user, index) => (
          <button
            key={user.authorId}
            type="button"
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
              index === selectedIndex
                ? 'bg-[--k-primary-2] text-[--k-primary]'
                : 'hover:bg-[--k-surface-2]'
            }`}
          >
            <AuthorAvatar name={user.authorName} />
            <div className="min-w-0">
              <span className="block font-medium text-[--k-text] truncate">
                {user.authorName}
              </span>
              <span className="block text-[11px] text-[--k-muted]">
                @{user.authorUsername}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = 'MentionList';
export default MentionList;
