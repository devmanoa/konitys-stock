/**
 * Format QR code Selfizee — voir doc "Règle de génération des références
 * produit", section 6.
 *
 *   Produit géré en quantité :        SZ:v1:PRODUCT:<REF>
 *   Produit avec N° de série constr.: SZ:v1:PRODUCT:<REF>:SN:<serialNumber>
 *   Article interne unique :          SZ:v1:ITEM:<internalId>
 *
 * REF = référence interne (ex: IMPR-DNP-DS620), lettres/chiffres/tirets.
 *
 * Pour compat rétro-active on garde le support des anciens QR au format
 * URL (`/products/<uuid>`, `/serial/<uuid>`) tant qu'ils circulent en
 * atelier.
 */

/** Construit un payload QR pour un produit géré en quantité. */
export function qrForProduct(reference: string): string {
  return `SZ:v1:PRODUCT:${reference}`;
}

/** Produit avec numéro de série constructeur (SN encodé dans le QR). */
export function qrForProductWithSerial(reference: string, serialNumber: string): string {
  return `SZ:v1:PRODUCT:${reference}:SN:${serialNumber}`;
}

/** Article interne unique (typiquement un ProductSerialItem interne). */
export function qrForInternalItem(internalId: string): string {
  return `SZ:v1:ITEM:${internalId}`;
}

/** Résultat du parsing d'un payload QR (nouveau format ET legacy URL). */
export type ParsedQrPayload =
  | {
      kind: 'product';
      /** Référence produit (SZ format) OU UUID (legacy URL / bare UUID). */
      idOrRef: string;
      /** N° de série constructeur si présent (SZ format uniquement). */
      serialNumber?: string;
      raw: string;
    }
  | {
      kind: 'serial';
      /** UUID d'un ProductSerialItem interne (legacy URL). */
      id: string;
      raw: string;
    }
  | {
      kind: 'item';
      /** Identifiant interne (SZ format, ex: IMP-0001). */
      itemId: string;
      raw: string;
    }
  | {
      kind: 'unknown';
      raw: string;
    };

// UUID v4-ish, 8-4-4-4-12 hex chars.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const STRICT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Charset autorisé dans une référence produit : chiffres/lettres/tirets.
// Volontairement strict : les chiffres+lettres+tirets sont la seule sortie
// de generateUniqueReference côté serveur.
const REF_RE = /[A-Z0-9-]{2,80}/;

/**
 * Parse un payload QR. Reconnaît le nouveau format `SZ:v1:...` en priorité,
 * puis les anciens formats URL, puis un bare UUID (fallback historique).
 */
export function parseQrPayload(payload: string): ParsedQrPayload {
  const raw = payload.trim();

  // 1. Nouveau format SZ:v1:*
  //    - SZ:v1:PRODUCT:<REF>
  //    - SZ:v1:PRODUCT:<REF>:SN:<serialNumber>
  //    - SZ:v1:ITEM:<internalId>
  const sz = /^SZ:v1:(PRODUCT|ITEM):(.+)$/i.exec(raw);
  if (sz) {
    const type = sz[1].toUpperCase();
    const rest = sz[2];
    if (type === 'PRODUCT') {
      // Support optionnel du suffixe :SN:<serial>
      const withSn = /^([A-Z0-9-]{2,80}):SN:(.+)$/i.exec(rest);
      if (withSn) {
        return {
          kind: 'product',
          idOrRef: withSn[1].toUpperCase(),
          serialNumber: withSn[2].trim(),
          raw,
        };
      }
      if (REF_RE.test(rest.toUpperCase())) {
        return { kind: 'product', idOrRef: rest.toUpperCase(), raw };
      }
    }
    if (type === 'ITEM') {
      return { kind: 'item', itemId: rest.trim(), raw };
    }
    return { kind: 'unknown', raw };
  }

  // 2. Legacy URL : on ne considère que le chemin, pas la QS.
  const path = raw.split(/[?#]/, 1)[0] ?? raw;
  const productMatch = path.match(new RegExp(`/products/(${UUID_RE.source})`, 'i'));
  if (productMatch) return { kind: 'product', idOrRef: productMatch[1].toLowerCase(), raw };
  const serialMatch = path.match(new RegExp(`/serial(?:-items)?/(${UUID_RE.source})`, 'i'));
  if (serialMatch) return { kind: 'serial', id: serialMatch[1].toLowerCase(), raw };

  // 3. Bare UUID (ancien usage) → product par UUID.
  if (STRICT_UUID_RE.test(raw)) return { kind: 'product', idOrRef: raw.toLowerCase(), raw };

  return { kind: 'unknown', raw };
}
