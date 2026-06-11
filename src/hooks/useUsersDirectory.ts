import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface DirectoryUser {
  id: string;
  keycloakId: string;
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
 * Two indexes are built once when the query data lands:
 *   - byName     fullName.toLowerCase().trim() -> user (O(1) for OperatorAvatar)
 *   - byKid      keycloakId -> user
 *
 * Without these, rendering a table with N rows did N linear scans of the
 * directory per render.
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

  const photoUrl = useCallback(
    (photoNom: string | null | undefined): string | null => {
      if (!photoNom || !gateway) return null;
      return `${gateway}/uploads/contacts/${photoNom}`;
    },
    [gateway],
  );

  const { byName, byKid } = useMemo(() => {
    const byName = new Map<string, DirectoryUser>();
    const byKid = new Map<string, DirectoryUser>();
    for (const u of query.data || []) {
      if (u.fullName) byName.set(u.fullName.trim().toLowerCase(), u);
      if (u.keycloakId) byKid.set(u.keycloakId, u);
    }
    return { byName, byKid };
  }, [query.data]);

  const findByName = useCallback(
    (name?: string | null): DirectoryUser | undefined => {
      if (!name) return undefined;
      const key = name.trim().toLowerCase();
      if (!key) return undefined;
      return byName.get(key);
    },
    [byName],
  );

  const findByKeycloakId = useCallback(
    (kid?: string | null): DirectoryUser | undefined => {
      if (!kid) return undefined;
      return byKid.get(kid);
    },
    [byKid],
  );

  const pictureFor = useCallback(
    (name?: string | null): string | null => {
      const u = findByName(name);
      return photoUrl(u?.photoNom);
    },
    [findByName, photoUrl],
  );

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    findByName,
    findByKeycloakId,
    pictureFor,
    photoUrl,
  };
}
