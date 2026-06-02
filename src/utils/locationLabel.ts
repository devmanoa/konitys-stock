import type { Location } from '../types'

/**
 * Build a display label for a location, walking up the parent chain.
 * Examples:
 *   - "Allée 1"
 *   - "Allée 1 / Rack A"
 *   - "Siège · Allée 1 / Rack A" (when includeSite)
 */
export function locationLabel(
  location: Location | null | undefined,
  options: { includeSite?: boolean; separator?: string } = {},
): string {
  if (!location) return ''
  const sep = options.separator ?? ' / '
  // Walk up via parent (the API resolves one level of parent — enough for our 2-level cap)
  const parts: string[] = []
  let current: Location | null | undefined = location
  while (current) {
    parts.unshift(current.name)
    current = current.parent ?? null
  }
  let label = parts.join(sep)
  if (options.includeSite) {
    const site = location.site || location.parent?.site
    if (site?.name) label = `${site.name} · ${label}`
  }
  return label
}
