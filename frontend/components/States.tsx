export function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading fleet">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-xl border border-edge bg-panel/60" />
      ))}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-center">
      <p className="text-sm text-red-100">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-[44px] rounded-lg border border-red-400/40 bg-red-500/15 px-4 text-sm text-red-100 transition hover:bg-red-500/25"
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ onAdd, busy }: { onAdd: () => void; busy: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-edge bg-panel/40 p-10 text-center">
      <h2 className="text-base font-medium text-slate-200">No vehicles in the fleet yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
        Add one to start monitoring it, or run <code className="text-slate-300">npm run seed</code> in
        the backend to load the demo fleet.
      </p>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="mt-5 min-h-[44px] rounded-lg bg-sky-500/90 px-4 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add a vehicle'}
      </button>
    </div>
  );
}
