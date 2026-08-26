'use client';

interface Props {
  label: string;
  onClick: () => void;
  disabledReason: string | null;
  busy?: boolean;
  variant?: 'default' | 'primary' | 'danger';
}

const VARIANTS = {
  default: 'bg-white/5 hover:bg-white/10 text-slate-200 border-edge',
  primary: 'bg-sky-500/90 hover:bg-sky-400 text-slate-950 border-sky-400/40 font-medium',
  danger: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30',
} as const;

/**
 * A disabled action always says WHY, via title + aria-label — the rules are
 * legible before the click, not only after a rejection.
 */
export function ActionButton({ label, onClick, disabledReason, busy, variant = 'default' }: Props) {
  const disabled = Boolean(disabledReason) || Boolean(busy);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledReason ?? undefined}
      aria-label={disabledReason ? `${label} — ${disabledReason}` : label}
      className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm transition
        disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]}`}
    >
      {busy ? 'Working…' : label}
    </button>
  );
}
