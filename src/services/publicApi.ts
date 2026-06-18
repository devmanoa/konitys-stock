import axios from 'axios'

/**
 * Lightweight axios instance for the public mobile share-link routes.
 *
 * Differs from `services/api.ts` in two ways:
 *   - No Keycloak token in the Authorization header. The share link itself is
 *     the credential, embedded in the URL.
 *   - No 401 logout interceptor. A 410 (revoked/expired) bubbles up so the
 *     mobile UI can show a clear "Lien expiré" screen.
 *
 * Base URL points at `/api/public` so callers can write
 * `publicApi.get(`inventory/${linkId}`)`.
 */
const publicApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/public`,
  headers: { 'Content-Type': 'application/json' },
})

export default publicApi
