import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import keycloak from '../config/keycloak';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  picture?: string;
  roles: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Tracks the last photoNom we POSTed to /users/sync. Avoids spamming the
  // endpoint every 60s when the token refreshes but nothing has changed.
  const lastSyncedPhotoRef = useRef<string | null | undefined>(undefined);
  // Guards against double Keycloak.init() (React StrictMode mounts twice)
  // and lets us clear the refresh interval on unmount.
  const initStartedRef = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch the gateway profile to retrieve photo_nom (and any other CRM data
  // not present in the JWT). Fails silently — the avatar will fall back to
  // initials if the gateway is unreachable.
  // NB: every log here gates on import.meta.env.DEV so we don't leak emails,
  // tokens, or auth response bodies in prod browser consoles (shared / remote
  // debugging contexts).
  const fetchProfile = useCallback(async (token: string): Promise<{ photoNom?: string } | null> => {
    const gateway = import.meta.env.VITE_GATEWAY_URL;
    if (!gateway) {
      if (import.meta.env.DEV) console.warn('[Auth] VITE_GATEWAY_URL is not set.');
      return null;
    }
    const url = `${gateway}/api/users/me`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[Auth] /api/users/me failed:', res.status);
        }
        return null;
      }
      const json = await res.json();
      // Try multiple shapes: flat object, { data: {...} }, { user: {...} }
      const profile = json?.data ?? json?.user ?? json;
      const photoNom =
        profile?.photo_nom ??
        profile?.photoNom ??
        profile?.photo ??
        profile?.avatar ??
        undefined;
      return { photoNom };
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[Auth] /api/users/me threw:', err);
      }
      return null;
    }
  }, []);

  const updateUserInfo = useCallback(async () => {
    if (!keycloak.tokenParsed) return;
    const parsed = keycloak.tokenParsed as Record<string, unknown>;
    const baseUser: User = {
      id: parsed.sub as string,
      email: (parsed.email as string) || '',
      username: (parsed.preferred_username as string) || '',
      firstName: parsed.given_name as string | undefined,
      lastName: parsed.family_name as string | undefined,
      fullName: parsed.name as string | undefined,
      roles: (parsed.realm_access as { roles: string[] })?.roles || [],
    };
    setUser(baseUser);
    setToken(keycloak.token || null);

    // Enrich with the picture from the gateway profile, then sync to our
    // own users table so other operators' avatars can be rendered later.
    const gateway = import.meta.env.VITE_GATEWAY_URL;
    let photoNom: string | undefined;
    if (keycloak.token && gateway) {
      const profile = await fetchProfile(keycloak.token);
      photoNom = profile?.photoNom;
      if (photoNom) {
        const pictureUrl = `${gateway}/uploads/contacts/${photoNom}`;
        setUser({ ...baseUser, picture: pictureUrl });
      }
    }
    // Fire-and-forget upsert into the local users table — only when the
    // photoNom actually changed, so the 60s token refresh interval doesn't
    // hammer /users/sync forever.
    const nextPhoto = photoNom ?? null;
    if (nextPhoto !== lastSyncedPhotoRef.current) {
      lastSyncedPhotoRef.current = nextPhoto;
      try {
        await api.post('/users/sync', { photoNom: nextPhoto });
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[Auth] /users/sync failed:', err);
        }
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    // React StrictMode mounts the provider twice in dev. Calling keycloak.init
    // a second time crashes the lib ("can only be called once"), so we guard.
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required',
          checkLoginIframe: false,
        });

        setIsAuthenticated(authenticated);

        if (authenticated) {
          updateUserInfo();

          // Token refresh — keep a handle so we can clear it on unmount.
          refreshIntervalRef.current = setInterval(async () => {
            if (keycloak.authenticated) {
              try {
                const refreshed = await keycloak.updateToken(70);
                if (refreshed) {
                  updateUserInfo();
                }
              } catch (error) {
                if (import.meta.env.DEV) {
                  // eslint-disable-next-line no-console
                  console.error('Token refresh failed:', error);
                }
                keycloak.logout();
              }
            }
          }, 60000);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Keycloak initialization failed:', error);
        }
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initKeycloak();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [updateUserInfo]);

  const login = useCallback(() => {
    keycloak.login();
  }, []);

  const logout = useCallback(() => {
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const hasRole = useCallback((role: string) => {
    return user?.roles.includes(role) || false;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      token,
      login,
      logout,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
