'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconX } from '@/components/icons';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-card ring-1 ring-gray-100 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  captionTone = 'positive',
  icon,
  featured = false,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  captionTone?: 'positive' | 'neutral' | 'warning' | 'danger';
  icon: ReactNode;
  featured?: boolean;
}) {
  const tones: Record<string, string> = {
    positive: 'text-forest-600',
    neutral: 'text-gray-400',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };
  return (
    <Card className={`relative p-5 ${featured ? 'bg-forest-900 ring-0' : ''}`}>
      <span
        className={`absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full transition ${
          featured ? 'bg-white/10 text-green' : 'bg-canvas text-gray-500'
        }`}
      >
        {icon}
      </span>
      <p className={`text-sm font-medium ${featured ? 'text-forest-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`mt-2 text-[2rem] font-bold leading-none tracking-tight ${featured ? 'text-forest-600' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${tones[captionTone]} ${featured ? '!text-forest-300' : ''}`}>
        {featured ? <IconTrend /> : null}
        {caption}
      </p>
    </Card>
  );
}

function IconTrend() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-100';

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-forest-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export function DaysBadge({ days }: { days: number }) {
  if (isNaN(days)) {
    return <Pill tone="neutral">No expiry</Pill>;
  }
  if (days < 0) return <Pill tone="danger">Expired</Pill>;
  if (days <= 7) return <Pill tone="danger">{days}d left</Pill>;
  if (days <= 30) return <Pill tone="warning">{days}d left</Pill>;
  return <Pill tone="ok">{days}d left</Pill>;
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warning' | 'danger' | 'neutral' | 'progress';
}) {
  const tones: Record<string, { bg: string; dot: string; text: string }> = {
    ok: { bg: 'bg-forest-50', dot: 'bg-forest-500', text: 'text-forest-800' },
    progress: { bg: 'bg-lime-50', dot: 'bg-lime-500', text: 'text-lime-800' },
    warning: { bg: 'bg-amber-50', dot: 'bg-amber-400', text: 'text-amber-700' },
    danger: { bg: 'bg-red-50', dot: 'bg-red-400', text: 'text-red-600' },
    neutral: { bg: 'bg-gray-100', dot: 'bg-gray-300', text: 'text-gray-500' },
  };
  const t = tones[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.bg} ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-3xl bg-white p-6 shadow-float`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-canvas text-gray-500 transition hover:bg-gray-200"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-forest-100 border-t-forest-600" />
      {label ? <p className="text-sm text-gray-400">{label}</p> : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      {message}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-float">
      {message}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-float">
        <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <SecondaryButton onClick={onCancel}>{cancelLabel}</SecondaryButton>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-forest-900 hover:bg-forest-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  values,
  placeholder = 'Select.',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /**
   * Optional parallel array of stored values, when an option needs a label that
   * differs from what it means — "15 minutes" storing 900, for instance. When
   * omitted, the option text is used as the value, as before.
   */
  values?: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition ${
          open ? 'border-forest-500 ring-2 ring-forest-100' : 'border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-100'
        }`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {options[options.findIndex((_, i) => (values ? values[i] : options[i]) === value)] ?? placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute z-10 mt-1 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-float max-h-56">
          {options.map((opt, i) => {
            const optValue = values ? (values[i] ?? opt) : opt;
            return (
              <button
                key={optValue}
                type="button"
                onClick={() => { onChange(optValue); setOpen(false); }}
                className={`flex w-full items-center px-3.5 py-2 text-sm transition text-left ${
                  value === optValue
                    ? 'bg-forest-50 font-semibold text-forest-800'
                    : 'text-gray-700 hover:bg-canvas'
                }`}
              >
                {opt}
              </button>
            );
          })}
          {options.length === 0 ? (
            <p className="px-3.5 py-2 text-sm text-gray-400">No options</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
