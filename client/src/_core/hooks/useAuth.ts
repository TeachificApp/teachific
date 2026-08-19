import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";
import { CACHE_KEY } from "@/lib/authCache";

/** Read the last-known user from localStorage — used as optimistic initial state */
function getCachedUser() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw || raw === "null" || raw === "undefined") return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // Seed the tRPC cache with the localStorage value before the first network
  // request completes — this makes `isLoading` false immediately for returning
  // users, eliminating the blank/loading-screen flash on revisit.
  const cachedUser = getCachedUser();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // Use cached data as the initial value so loading=false on first render
    initialData: cachedUser as never,
    // Still fetch in the background to validate the session is still live
    staleTime: 0,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      localStorage.removeItem(CACHE_KEY);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      localStorage.removeItem(CACHE_KEY);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // Persist latest server-confirmed user to localStorage
    if (!meQuery.isLoading) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(meQuery.data ?? null));
    }

    // If we have cached data, never show loading — show cached user immediately
    // and let the background fetch silently update it.
    const effectiveLoading =
      meQuery.isLoading && !cachedUser && !meQuery.data
        ? true
        : logoutMutation.isPending;

    return {
      user: meQuery.data ?? null,
      loading: effectiveLoading,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    cachedUser,
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    state.loading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
