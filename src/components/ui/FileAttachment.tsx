import { Node, mergeAttributes } from '@tiptap/core';

/**
 * FileAttachment is a Tiptap node that renders a generic file as a clickable
 * "chip" with an icon, the file name and the size. The HTML is portable —
 * even outside the editor it renders as a sensible <a> link.
 *
 * Attrs:
 *   - href:     full URL of the file (required)
 *   - name:     original file name shown to the user
 *   - size:     human-readable size (e.g. "1.2 Mo") — optional
 *   - mimeType: file MIME type — used to pick the icon
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: {
        href: string;
        name: string;
        size?: string;
        mimeType?: string;
      }) => ReturnType;
    };
  }
}

function pickEmoji(mime?: string, name?: string): string {
  const m = (mime || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return '📄';
  if (m.includes('zip') || m.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/i.test(n)) return '🗜️';
  if (m.includes('sheet') || m.includes('excel') || /\.(xls|xlsx|csv|ods)$/i.test(n)) return '📊';
  if (m.includes('presentation') || m.includes('powerpoint') || /\.(ppt|pptx|odp)$/i.test(n)) return '📽️';
  if (m.includes('word') || m.includes('document') || /\.(doc|docx|odt|rtf|txt)$/i.test(n)) return '📝';
  if (m.startsWith('audio/')) return '🎵';
  if (m.startsWith('video/')) return '🎬';
  return '📎';
}

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: null },
      name: { default: 'fichier' },
      size: { default: null },
      mimeType: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-file-attachment]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return {
            href: node.getAttribute('href'),
            name: node.getAttribute('data-name') || node.textContent || 'fichier',
            size: node.getAttribute('data-size'),
            mimeType: node.getAttribute('data-mime'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { href, name, size, mimeType } = node.attrs as {
      href: string;
      name: string;
      size?: string | null;
      mimeType?: string | null;
    };
    const emoji = pickEmoji(mimeType || undefined, name);
    const sizeLabel = size ? ` (${size})` : '';
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-file-attachment': 'true',
        'data-name': name,
        'data-size': size ?? '',
        'data-mime': mimeType ?? '',
        class: 'rich-editor-file',
      }),
      `${emoji} ${name}${sizeLabel}`,
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

export default FileAttachment;
