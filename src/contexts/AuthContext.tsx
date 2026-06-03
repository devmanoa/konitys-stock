import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import keycloak from '../config/keycloak';

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

  // Fetch the gateway profile to retrieve photo_nom (and any other CRM data
  // not present in the JWT). Fails silently — the avatar will fall back to
  // initials if the gateway is unreachable.
  const fetchProfile = useCallback(async (token: string): Promise<{ photoNom?: string } | null> => {
    const gateway = import.meta.env.VITE_GATEWAY_URL;
    if (!gateway) return null;
    try {
      const res = await fetch(`${gateway}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { photo_nom?: string; photoNom?: string };
      return { photoNom: json.photo_nom || json.photoNom };
    } catch {
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

    // Enrich with the picture from the gateway profile.
    const gateway = import.meta.env.VITE_GATEWAY_URL;
    if (keycloak.token && gateway) {
      const profile = await fetchProfile(keycloak.token);
      if (profile?.photoNom) {
        const pictureUrl = `${gateway}/uploads/contacts/${profile.photoNom}`;
        // eslint-disable-next-line no-console
        console.log('[Auth] Profile picture URL:', pictureUrl);
        setUser({
          ...baseUser,
          picture: pictureUrl,
        });
      } else {
        // eslint-disable-next-line no-console
        console.log('[Auth] No photo_nom returned by gateway profile.');
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required',
          checkLoginIframe: false,
        });

        setIsAuthenticated(authenticated);

        if (authenticated) {
          updateUserInfo();

          // Setup token refresh
          setInterval(async () => {
            if (keycloak.authenticated) {
              try {
                const refreshed = await keycloak.updateToken(70);
                if (refreshed) {
                  updateUserInfo();
                }
              } catch (error) {
                console.error('Token refresh failed:', error);
                keycloak.logout();
              }
            }
          }, 60000);
        }
      } catch (error) {
        console.error('Keycloak initialization failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initKeycloak();
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
