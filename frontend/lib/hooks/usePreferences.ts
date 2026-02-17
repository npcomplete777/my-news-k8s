'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type { User, UserPreferences } from '@/lib/types';
import { getUser, updatePreferences } from '@/lib/api';

export function usePreferences() {
  const { data, error, isLoading, mutate } = useSWR<User>(
    '/api/user',
    () => getUser(),
    {
      revalidateOnFocus: false,
    }
  );

  const savePreferences = useCallback(
    async (prefs: UserPreferences) => {
      try {
        const updated = await updatePreferences(prefs);
        mutate(updated, false);
        return updated;
      } catch (err) {
        console.error('Failed to update preferences:', err);
        throw err;
      }
    },
    [mutate]
  );

  return {
    user: data,
    preferences: data?.preferences ?? {},
    isLoading,
    error,
    mutate,
    savePreferences,
  };
}
