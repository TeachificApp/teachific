import React, { type ComponentType } from "react";
import { createRoot } from "react-dom/client";

export type BootstrapImport = () => Promise<{ AppBootstrap: ComponentType }>;

export function mountCourse360Bootstrap(
  rootElement: Element,
  loadAppBootstrap: BootstrapImport,
  timeoutMs = 8_000,
) {
  const root = createRoot(rootElement);
  let appRendered = false;
  let fallbackRendered = false;
  let bootstrapTimeout: number | undefined;

  const renderBootstrapFallback = (error: unknown) => {
    if (fallbackRendered) return;
    fallbackRendered = true;
    if (bootstrapTimeout !== undefined) window.clearTimeout(bootstrapTimeout);
    console.error("[Course360 Bootstrap Error]", error);
    root.render(
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
      </main>,
    );
  };

  const renderBootstrapLoading = () => {
    root.render(
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">Loading Course360…</p>
        </div>
      </main>,
    );
  };

  renderBootstrapLoading();
  bootstrapTimeout = window.setTimeout(() => {
    if (!appRendered) {
      renderBootstrapFallback(new Error("The application took too long to load."));
    }
  }, timeoutMs);

  void loadAppBootstrap()
    .then(({ AppBootstrap }) => {
      appRendered = true;
      if (bootstrapTimeout !== undefined) window.clearTimeout(bootstrapTimeout);
      root.render(<AppBootstrap />);
    })
    .catch(renderBootstrapFallback);
}
