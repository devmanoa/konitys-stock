import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import keycloak from '../config/keycloak';

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
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

  const updateUserInfo = useCallback(() => {
    if (keycloak.tokenParsed) {
      const parsed = keycloak.tokenParsed as Record<string, unknown>;
      setUser({
        id: parsed.sub as string,
        email: (parsed.email as string) || '',
        username: (parsed.preferred_username as string) || '',
        firstName: parsed.given_name as string | undefined,
        lastName: parsed.family_name as string | undefined,
        fullName: parsed.name as string | undefined,
        roles: (parsed.realm_access as { roles: string[] })?.roles || [],
      });
      setToken(keycloak.token || null);
    }
  }, []);

  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'login-required',
          pkceMethod: 'S256',
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
