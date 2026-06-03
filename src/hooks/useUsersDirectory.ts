import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface DirectoryUser {
  id: string;
  keycloakId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  photoNom: string | null;
}

interface ListUsersResponse {
  success: boolean;
  data: DirectoryUser[];
}

/**
 * Loads every user that has ever logged into stock-management (we sync them
 * at login via /users/sync). Cached for 5 minutes so repeated avatar lookups
 * cost nothing.
 *
 * Returns helpers to look users up by name (case-insensitive) or by
 * keycloak id. Each helper returns the photo URL or null.
 */
export function useUsersDirectory() {
  const query = useQuery({
    queryKey: ['users-directory'],
    queryFn: async () => {
      const res = await api.get<ListUsersResponse>('/users');
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const gateway = import.meta.env.VITE_GATEWAY_URL as string | undefined;
  const photoUrl = (photoNom: string | null | undefined): string | null => {
    if (!photoNom || !gateway) return null;
    return `${gateway}/uploads/contacts/${photoNom}`;
  };

  const findByName = (name?: string | null): DirectoryUser | undefined => {
    if (!name) return undefined;
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return undefined;
    return query.data?.find((u) => (u.fullName || '').toLowerCase() === trimmed);
  };

  const findByKeycloakId = (kid?: string | null): DirectoryUser | undefined => {
    if (!kid) return undefined;
    return query.data?.find((u) => u.keycloakId === kid);
  };

  const pictureFor = (name?: string | null): string | null => {
    const u = findByName(name);
    return photoUrl(u?.photoNom);
  };

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    findByName,
    findByKeycloakId,
    pictureFor,
    photoUrl,
  };
}
