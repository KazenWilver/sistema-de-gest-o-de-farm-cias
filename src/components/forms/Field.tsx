import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/components/ui/cx';

const control =
  'block w-full rounded-lg border border-line-strong bg-surface px-3 text-ink placeholder:text-muted/70 ' +
  'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 ' +
  'disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-50';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Etiqueta, controlo, ajuda e erro ligados por id (acessível a leitores de ecrã). */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
        {required && (
          <span className="text-danger-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cx(control, 'h-10', className)} {...rest} />;
}

export function Select({
  className,
  ref,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className={cx(control, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ref,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cx(control, 'min-h-20 py-2', className)} {...rest} />;
}

export function Checkbox({
  label,
  hint,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; ref?: Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-line-strong accent-brand-700"
        {...rest}
      />
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}
