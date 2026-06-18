import DOMPurify from 'dompurify'

/**
 * Render content that MAY contain HTML (from the WYSIWYG editor) or may be
 * plain text. Used in detail views, comments, descriptions, etc.
 *
 * Heuristic: if the string looks like it has tags (a `<` followed by a
 * letter or `/`), we sanitize and render as HTML. Otherwise we render as
 * plain text with line-break preservation. This means legacy plain-text
 * entries don't suddenly grow surrounding `<p>` wrappers and stay readable.
 *
 * Sanitization uses DOMPurify with a conservative allowlist that matches
 * what the RichTextEditor (TipTap) can produce: paragraphs, lists, marks,
 * mentions, images uploaded via /uploads, and file-attachment links. Any
 * `<script>`, `on*` handler, `javascript:` URL etc. is stripped.
 */

// Tags TipTap can emit, plus the file-attachment / image / mention wrappers
// the editor produces. Keep this in sync with RichTextEditor.tsx extensions.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 's', 'u', 'code', 'pre',
  'ul', 'ol', 'li',
  'a', 'span',
  'img',
  'div',
  'h1', 'h2', 'h3', 'h4',
  'blockquote',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'title',
  'class',
  // Mention & file-attachment custom attributes the editor emits.
  'data-mention-id', 'data-mention-name', 'data-type',
  'data-file-id', 'data-file-name', 'data-file-size',
  // Image resize wrapper.
  'width', 'height', 'style',
]

function looksLikeHtml(s: string): boolean {
  // Matches a `<` followed by a letter or `/`, which is enough to detect
  // any real tag. Bare `<` in plain text (e.g. "< 5") won't match.
  return /<[a-zA-Z/]/.test(s)
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force-allow https, http, mailto, tel, relative paths. Blocks javascript:
    // and data: URIs by default — only data:image/* is allowed via the regex.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Belt and braces — even if a tag/attr slips through, refuse to render
    // anything that would execute code.
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onfocus', 'onmouseover'],
  })
}

interface Props {
  /** Raw content from the DB. May be HTML (WYSIWYG) or plain text. */
  content: string | null | undefined
  /** Optional className wrapping the rendered output. */
  className?: string
  /** Text to show when content is empty/null. Pass null to render nothing. */
  emptyFallback?: string | null
  /** Inline mode for use inside <td> / <span> contexts (no margins, single line allowed to wrap). */
  inline?: boolean
}

export default function RichTextDisplay({
  content,
  className = '',
  emptyFallback = 'Aucun commentaire',
  inline = false,
}: Props) {
  const trimmed = (content || '').trim()
  if (!trimmed) {
    if (emptyFallback === null) return null
    return (
      <span className={`italic text-[--k-muted] ${className}`}>{emptyFallback}</span>
    )
  }

  // The `comment-content` class is already styled in styles.css for lists,
  // images, code blocks, etc. We add it whenever we render HTML so the
  // formatting actually shows.
  const baseClass = inline ? '' : 'comment-content'
  const merged = `${baseClass} ${className}`.trim()

  if (looksLikeHtml(trimmed)) {
    return (
      <div
        className={merged}
        dangerouslySetInnerHTML={{ __html: sanitize(trimmed) }}
      />
    )
  }

  // Plain text: preserve line breaks but escape via React's default text
  // handling.
  return (
    <div className={`${merged} whitespace-pre-wrap`}>{trimmed}</div>
  )
}

/**
 * Strip all HTML tags from a string. Useful for displaying rich content
 * as a plain identifier (titles, dropdowns, search results) where the
 * formatting would break the surrounding layout.
 */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  if (!looksLikeHtml(s)) return s
  // Sanitize first to ensure we don't keep weird payloads, then strip tags.
  const safe = DOMPurify.sanitize(s, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  // DOMPurify with empty allowlist returns just text content.
  return safe.replace(/\s+/g, ' ').trim()
}
