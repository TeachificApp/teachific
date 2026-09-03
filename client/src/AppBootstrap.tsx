import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import React, { lazy, Suspense } from "react";
import superjson from "superjson";
import { getLoginUrl } from "./const";

function AppLoadFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-600">Loading Course360…</p>
      </div>
    </main>
  );
}

function AppLoadFailure() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Course360™</p>
        <h1 className="mt-3 text-2xl font-semibold">We could not load this page.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Please retry. If the issue continues, return to Course360 later or contact your organization administrator.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          onClick={() => window.location.reload()}
        >
          Retry loading Course360
        </button>
      </section>
    </main>
  );
}

const DeferredApp = lazy(async () => {
  try {
    return await import("./App");
  } catch (error) {
    console.error("[Course360 App Load Error]", error);
    return { default: AppLoadFailure };
  }
});

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message !== UNAUTHED_ERR_MSG) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function AppBootstrap() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<AppLoadFallback />}>
          <DeferredApp />
        </Suspense>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
