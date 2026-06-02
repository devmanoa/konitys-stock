import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  AtSign,
  Send,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import Image from '@tiptap/extension-image';
import api from '../../services/api';
import MentionList, { type MentionListRef } from './MentionList';
import type { KnownUser } from '../../types';

interface ToolbarButtonProps {
  icon: React.ElementType;
  isActive?: boolean;
  onClick: () => void;
  title: string;
}

function ToolbarButton({ icon: Icon, isActive, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        isActive
          ? 'bg-[--k-primary-2] text-[--k-primary]'
          : 'text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Toolbar({
  editor,
  onSubmit,
  isSubmitting,
  hasContent,
  onImageClick,
  isUploadingImage,
}: {
  editor: Editor;
  onSubmit?: () => void;
  isSubmitting: boolean;
  hasContent: boolean;
  onImageClick: () => void;
  isUploadingImage: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 border-t border-[--k-border] px-2 py-1.5">
      <ToolbarButton
        icon={Bold}
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Gras (Ctrl+B)"
      />
      <ToolbarButton
        icon={Italic}
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italique (Ctrl+I)"
      />
      <ToolbarButton
        icon={Strikethrough}
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Barré"
      />
      <ToolbarButton
        icon={Code}
        isActive={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code inline"
      />

      <div className="mx-1 h-4 w-px bg-[--k-border]" />

      <ToolbarButton
        icon={List}
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Liste à puces"
      />
      <ToolbarButton
        icon={ListOrdered}
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Liste numérotée"
      />

      <div className="mx-1 h-4 w-px bg-[--k-border]" />

      <ToolbarButton
        icon={AtSign}
        isActive={false}
        onClick={() => {
          editor.chain().focus().insertContent('@').run();
        }}
        title="Mentionner (@)"
      />
      <ToolbarButton
        icon={isUploadingImage ? Loader2 : ImagePlus}
        isActive={false}
        onClick={onImageClick}
        title={isUploadingImage ? 'Envoi en cours...' : 'Ajouter une image'}
      />

      <div className="flex-1" />

      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasContent || isSubmitting}
          className="flex h-7 items-center gap-1.5 rounded-md bg-[--k-primary] px-2.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-3 w-3" />
          {isSubmitting ? 'Envoi...' : 'Envoyer'}
        </button>
      )}
    </div>
  );
}

interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onSubmit?: (html: string) => void;
  onChange?: (html: string) => void;
  isSubmitting?: boolean;
  fetchMentions: (query: string) => Promise<KnownUser[]> | KnownUser[];
  showToolbar?: boolean;
  autoFocus?: boolean;
  editorKey?: string | number;
}

export default function RichTextEditor({
  content = '',
  placeholder = 'Ajouter un commentaire...',
  onSubmit,
  onChange,
  isSubmitting = false,
  fetchMentions,
  showToolbar = true,
  autoFocus = false,
  editorKey,
}: RichTextEditorProps) {
  const fetchMentionsRef = useRef(fetchMentions);
  fetchMentionsRef.current = fetchMentions;

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const doSubmit = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.getHTML();
    const isEmpty = !html || html === '<p></p>';
    if (isEmpty) return;
    onSubmitRef.current?.(html);
  }, []);

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still triggers onChange.
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      // eslint-disable-next-line no-console
      console.warn('Type d\'image non supporté. Utilisez JPEG, PNG, GIF ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      // eslint-disable-next-line no-console
      console.warn('Image trop volumineuse (max 5 Mo).');
      return;
    }
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post<{ success: boolean; data?: { imageUrl: string } }>(
        '/upload/image',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const imageUrl = res.data?.data?.imageUrl;
      if (!imageUrl) return;
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');
      const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${apiBase}${imageUrl}`;
      const ed = editorRef.current;
      ed?.chain().focus().setImage({ src: fullUrl, alt: file.name }).run();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Upload image RichTextEditor failed', err);
    } finally {
      setIsUploadingImage(false);
    }
  }, []);

  const mentionSuggestion: Omit<SuggestionOptions<KnownUser>, 'editor'> = {
    items: async ({ query }) => {
      return fetchMentionsRef.current(query);
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      return {
        onStart: (props: SuggestionProps<KnownUser>) => {
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items,
              command: props.command,
            },
            editor: props.editor,
          });

          popup = document.createElement('div');
          popup.style.position = 'absolute';
          popup.style.zIndex = '50';
          popup.appendChild(component.element);
          document.body.appendChild(popup);

          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },
        onUpdate: (props: SuggestionProps<KnownUser>) => {
          component?.updateProps({
            items: props.items,
            command: props.command,
          });

          const rect = props.clientRect?.();
          if (rect && popup) {
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.remove();
            component?.destroy();
            popup = null;
            component = null;
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          horizontalRule: false,
          codeBlock: false,
        }),
        Mention.configure({
          HTMLAttributes: {
            class: 'mention',
          },
          suggestion: mentionSuggestion,
          renderHTML: ({ node }) => {
            return [
              'span',
              {
                class: 'mention',
                'data-type': 'mention',
                'data-id': node.attrs.id,
              },
              `@${node.attrs.label ?? node.attrs.id}`,
            ];
          },
          renderText: ({ node }) => {
            return `@${node.attrs.label ?? node.attrs.id}`;
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
        Image.configure({
          HTMLAttributes: {
            class: 'rich-editor-image',
          },
          // Inline so an image can sit alongside text without forcing a new paragraph.
          inline: false,
          allowBase64: false,
        }),
      ],
      content,
      autofocus: autoFocus,
      editorProps: {
        attributes: {
          class: 'outline-none min-h-[48px] px-3 py-2 text-[13px] text-[--k-text] prose-sm max-w-none',
        },
        handleKeyDown: (_view, event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            doSubmit();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        setHasContent(!!html && html !== '<p></p>');
        onChange?.(html);
      },
      onCreate: ({ editor: ed }) => {
        editorRef.current = ed;
        const html = ed.getHTML();
        setHasContent(!!html && html !== '<p></p>');
      },
    },
    [editorKey]
  );

  // Keep ref in sync
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync content from outside (e.g. after clear)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-[--k-border] bg-white overflow-hidden focus-within:border-[--k-primary] focus-within:ring-1 focus-within:ring-[--k-primary]/20 transition-colors">
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleImageSelected}
      />
      {showToolbar && (
        <Toolbar
          editor={editor}
          onSubmit={doSubmit}
          isSubmitting={isSubmitting}
          hasContent={hasContent}
          onImageClick={handleImageButtonClick}
          isUploadingImage={isUploadingImage}
        />
      )}
    </div>
  );
}
