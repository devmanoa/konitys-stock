import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, type NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { Download, FileText, FileSpreadsheet, FileArchive, Presentation, FileCode, Music, Video, File as FileIcon } from 'lucide-react';

/**
 * FileAttachment renders any uploaded file as a JIRA-like card with:
 *   - colored icon by file type (or a PDF first-page thumbnail when possible)
 *   - file name + size
 *   - a download button
 *
 * The HTML produced is portable: it falls back to a plain styled <a> when
 * rendered outside the editor (via the renderHTML hook), so server-side or
 * read-only views still display a clickable link.
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

type FileKind = 'pdf' | 'zip' | 'sheet' | 'presentation' | 'doc' | 'audio' | 'video' | 'code' | 'other';

function classify(mime?: string | null, name?: string | null): FileKind {
  const m = (mime || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (m.includes('zip') || m.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/i.test(n)) return 'zip';
  if (m.includes('sheet') || m.includes('excel') || /\.(xls|xlsx|csv|ods)$/i.test(n)) return 'sheet';
  if (m.includes('presentation') || m.includes('powerpoint') || /\.(ppt|pptx|odp)$/i.test(n)) return 'presentation';
  if (m.includes('word') || m.includes('document') || /\.(doc|docx|odt|rtf|txt)$/i.test(n)) return 'doc';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (/\.(json|js|ts|tsx|jsx|html|css|xml|yaml|yml|md)$/i.test(n)) return 'code';
  return 'other';
}

function iconFor(kind: FileKind) {
  switch (kind) {
    case 'pdf': return { Icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    case 'zip': return { Icon: FileArchive, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'sheet': return { Icon: FileSpreadsheet, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'presentation': return { Icon: Presentation, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
    case 'doc': return { Icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'audio': return { Icon: Music, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' };
    case 'video': return { Icon: Video, color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' };
    case 'code': return { Icon: FileCode, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
    default: return { Icon: FileIcon, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
}

/**
 * Render a small PDF thumbnail (first page) into the given canvas using pdfjs.
 * Returns the data URL when done so the caller can keep it as <img> src.
 * Loaded lazily because pdfjs is heavy (~1MB).
 */
async function renderPdfThumbnail(url: string, maxWidth = 120): Promise<string | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    // Vite-friendly worker URL import.
    // @ts-ignore — pdfjs-dist ships the worker as a separate entry.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default as string;
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const doc = await pdfjs.getDocument({ url, withCredentials: false }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('PDF thumbnail failed', err);
    return null;
  }
}

function FileNodeView({ node }: NodeViewProps) {
  const { href, name, size, mimeType } = node.attrs as {
    href: string;
    name: string;
    size?: string | null;
    mimeType?: string | null;
  };
  const kind = classify(mimeType, name);
  const { Icon, color, bg, border } = iconFor(kind);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (kind === 'pdf' && href) {
      renderPdfThumbnail(href).then((url) => {
        if (!cancelledRef.current) setThumbnail(url);
      });
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [kind, href]);

  return (
    <NodeViewWrapper
      className={`rich-editor-file-card-wrap not-prose my-2`}
      contentEditable={false}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        download={name}
        className={`rich-editor-file-card group flex items-stretch gap-3 rounded-xl border ${border} ${bg} p-2 pr-3 transition hover:shadow-sm hover:border-[--k-primary] no-underline`}
      >
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white border ${border} overflow-hidden`}>
          {thumbnail ? (
            <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className={`h-7 w-7 ${color}`} />
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center min-w-0">
          <div className={`text-[13px] font-medium ${color} truncate`}>{name}</div>
          <div className="text-[11px] text-[--k-muted]">
            {kind.toUpperCase()}{size ? ` · ${size}` : ''}
          </div>
        </div>
        <div className={`flex shrink-0 items-center self-center text-[--k-muted] group-hover:text-[--k-primary]`}>
          <Download className="h-4 w-4" />
        </div>
      </a>
    </NodeViewWrapper>
  );
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
    const sizeLabel = size ? ` (${size})` : '';
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        download: name,
        'data-file-attachment': 'true',
        'data-name': name,
        'data-size': size ?? '',
        'data-mime': mimeType ?? '',
        class: 'rich-editor-file',
      }),
      `📎 ${name}${sizeLabel}`,
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

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },
});

export default FileAttachment;
