import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button, Spinner } from './Button';
import { cx } from './cx';

export { Button, ButtonLink, Spinner, buttonClass } from './Button';
export { cx } from './cx';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-xl border border-line bg-surface', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft ring-line-strong',
  success: 'bg-success-50 text-success-600 ring-success-600/25',
  warning: 'bg-warning-50 text-warning-700 ring-warning-600/30',
  danger: 'bg-danger-50 text-danger-700 ring-danger-600/25',
  info: 'bg-info-50 text-info-600 ring-info-600/25',
  brand: 'bg-brand-50 text-brand-800 ring-brand-600/25',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Exclude<Tone, 'neutral' | 'brand'>;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-info-600/25 bg-info-50',
    success: 'border-success-600/25 bg-success-50',
    warning: 'border-warning-600/30 bg-warning-50',
    danger: 'border-danger-600/25 bg-danger-50',
  }[tone];
  return (
    <div
      className={cx('rounded-lg border px-4 py-3 text-sm text-ink-soft', styles, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title && <p className="font-semibold text-ink">{title}</p>}
      {children && <div className={cx(title && 'mt-1')}>{children}</div>}
    </div>
  );
}

export function LoadingState({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted" role="status" aria-live="polite">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-4 py-8">
      <Notice tone="danger" title="Não foi possível carregar os dados">
        <p>{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </Notice>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Diálogo modal nativo (<dialog>): foco preso, Esc fecha, acessível por omissão. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl',
        wide ? 'max-w-2xl' : 'max-w-md',
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="border-b border-line px-5 py-4">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Voltar
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm text-ink-soft">{children}</div>
    </Dialog>
  );
}

/** Lista de pares etiqueta/valor (resumos de confirmação e detalhes). */
export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.id
              ? 'border-brand-700 text-brand-800'
              : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
  to,
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  hint?: ReactNode;
  to?: string;
}) {
  const accent = { neutral: 'text-ink', warning: 'text-warning-700', danger: 'text-danger-700' }[tone];
  const content = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular', accent)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-line bg-surface px-4 py-3.5';
  return to ? (
    <Link to={to} className={cx(cls, 'transition-colors hover:border-brand-200 hover:bg-brand-50/40')}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
