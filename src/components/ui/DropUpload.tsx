import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

/**
 * DropUpload: enables drag-and-drop file insertion into the editor.
 *
 * - Images are uploaded as embedded <img> (resizable via ResizableImage).
 * - Other files become FileAttachment cards.
 *
 * The actual upload logic is delegated to the callbacks because they need
 * access to the same axios instance and feedback state used by the toolbar
 * buttons (so the loading spinner stays in sync).
 */

export interface DropUploadOptions {
  onDropImage: (file: File) => Promise<void>;
  onDropFile: (file: File) => Promise<void>;
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const DropUpload = Extension.create<DropUploadOptions>({
  name: 'dropUpload',

  addOptions() {
    return {
      onDropImage: async () => {},
      onDropFile: async () => {},
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key: new PluginKey('dropUpload'),
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              const dt = event.dataTransfer;
              view.dom.classList.remove('is-drop-target');
              if (!dt || !dt.files || dt.files.length === 0) return false;

              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);
              if (pos) {
                const $pos = view.state.doc.resolve(pos.pos);
                const tr = view.state.tr.setSelection(TextSelection.near($pos));
                view.dispatch(tr);
              }

              event.preventDefault();
              const files = Array.from(dt.files);
              (async () => {
                for (const file of files) {
                  if (IMAGE_MIMES.includes(file.type)) {
                    await opts.onDropImage(file);
                  } else {
                    await opts.onDropFile(file);
                  }
                }
              })();
              return true;
            },
            dragenter: (view, event) => {
              if (event.dataTransfer?.types?.includes('Files')) {
                view.dom.classList.add('is-drop-target');
              }
              return false;
            },
            dragover: (_view, event) => {
              if (event.dataTransfer?.types?.includes('Files')) {
                event.preventDefault();
                return false;
              }
              return false;
            },
            dragleave: (view, event) => {
              // Only clear when leaving the editor itself, not bubbling from children.
              if (event.target === view.dom) {
                view.dom.classList.remove('is-drop-target');
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

export default DropUpload;
