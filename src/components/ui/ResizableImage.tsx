import { useState, useRef, useCallback, useEffect } from 'react';
import { NodeViewWrapper, type NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { Settings2, Check, X } from 'lucide-react';

/**
 * ResizableImage extends Tiptap's Image with:
 *   - drag-handles at the bottom-right corner to resize visually
 *   - a small popover to type exact width / height (px or %)
 *
 * The width/height are stored as plain HTML attributes on the <img>, so the
 * resulting HTML stays portable (any browser will render it correctly).
 */

function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, alt, width, height } = node.attrs as {
    src: string;
    alt?: string;
    width?: string | number | null;
    height?: string | number | null;
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [widthInput, setWidthInput] = useState<string>(width ? String(width) : '');
  const [heightInput, setHeightInput] = useState<string>(height ? String(height) : '');

  useEffect(() => {
    setWidthInput(width ? String(width) : '');
    setHeightInput(height ? String(height) : '');
  }, [width, height]);

  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imgRef.current) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = imgRef.current.offsetWidth;
    const startHeight = imgRef.current.offsetHeight;
    const aspectRatio = startWidth / Math.max(1, startHeight);
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Use the larger delta to keep aspect ratio when shift is NOT held.
      // Hold shift to free-resize (independent width / height).
      let newW = Math.max(40, startWidth + dx);
      let newH = Math.max(40, startHeight + dy);
      if (!ev.shiftKey) {
        // Keep aspect ratio, driven by the larger move axis.
        if (Math.abs(dx) >= Math.abs(dy)) {
          newH = Math.round(newW / aspectRatio);
        } else {
          newW = Math.round(newH * aspectRatio);
        }
      }
      updateAttributes({ width: String(newW), height: String(newH) });
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [updateAttributes]);

  const applyPopover = useCallback(() => {
    const w = widthInput.trim();
    const h = heightInput.trim();
    updateAttributes({
      width: w === '' ? null : w,
      height: h === '' ? null : h,
    });
    setShowPopover(false);
  }, [widthInput, heightInput, updateAttributes]);

  const resetSize = useCallback(() => {
    updateAttributes({ width: null, height: null });
    setWidthInput('');
    setHeightInput('');
  }, [updateAttributes]);

  const styleAttrs: React.CSSProperties = {
    width: width ? (String(width).match(/^\d+$/) ? `${width}px` : String(width)) : undefined,
    height: height ? (String(height).match(/^\d+$/) ? `${height}px` : String(height)) : undefined,
    maxWidth: '100%',
    display: 'block',
  };

  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={`rich-editor-image-wrapper ${selected ? 'is-selected' : ''} ${isResizing ? 'is-resizing' : ''}`}
      data-drag-handle
    >
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          style={styleAttrs}
          className="rich-editor-image rounded-lg border border-[--k-border]"
          draggable={false}
        />
        {isEditable && selected && (
          <>
            {/* Settings button (opens popover for exact dimensions) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPopover((v) => !v);
              }}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[--k-muted] shadow-sm border border-[--k-border] hover:text-[--k-primary] hover:bg-white"
              title="Dimensions exactes"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            {/* Bottom-right resize handle */}
            <div
              onMouseDown={onMouseDownHandle}
              className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-[--k-primary] border-2 border-white rounded-sm shadow"
              title="Glisser pour redimensionner (Shift = libre)"
            />

            {showPopover && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-10 right-1 z-10 flex items-end gap-2 rounded-lg border border-[--k-border] bg-white p-2 shadow-lg"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[--k-muted]">Largeur</label>
                  <input
                    type="text"
                    value={widthInput}
                    onChange={(e) => setWidthInput(e.target.value)}
                    placeholder="300 ou 50%"
                    className="w-24 rounded border border-[--k-border] px-2 py-1 text-[12px] focus:border-[--k-primary] focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[--k-muted]">Hauteur</label>
                  <input
                    type="text"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    placeholder="auto"
                    className="w-24 rounded border border-[--k-border] px-2 py-1 text-[12px] focus:border-[--k-primary] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyPopover}
                  className="flex h-7 w-7 items-center justify-center rounded bg-[--k-primary] text-white hover:brightness-110"
                  title="Appliquer"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetSize}
                  className="flex h-7 w-7 items-center justify-center rounded border border-[--k-border] text-[--k-muted] hover:text-[--k-danger]"
                  title="Réinitialiser"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width };
        },
        parseHTML: (el) => (el as HTMLElement).getAttribute('width'),
      },
      height: {
        default: null,
        renderHTML: (attrs) => {
          if (!attrs.height) return {};
          return { height: attrs.height };
        },
        parseHTML: (el) => (el as HTMLElement).getAttribute('height'),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

export default ResizableImage;
